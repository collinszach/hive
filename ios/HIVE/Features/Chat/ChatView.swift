import SwiftUI

/// Natural-language finance assistant (`POST /api/chat`). Pushed from the Insights
/// tab. Message bubbles + a keyboard-aware composer pinned to the bottom safe area;
/// an empty state offers starter prompts. Defaults to the local model (Ollama); a
/// toolbar menu switches to Claude (Pro-gated server-side).
struct ChatView: View {
    @State private var model = ChatViewModel()
    @State private var draft = ""
    @State private var showPaywall = false
    @FocusState private var composerFocused: Bool

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            if model.isEmpty && !model.isSending {
                emptyState
            } else {
                conversation
            }
        }
        .navigationTitle("Assistant")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { modelMenu }
        }
        .safeAreaInset(edge: .bottom) { composer }
        .sheet(isPresented: $showPaywall) {
            PaywallView(reason: "Unlock the AI assistant with the Pro plan.")
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: Conversation

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Theme.Spacing.md) {
                    ForEach(model.messages) { msg in
                        ChatBubble(message: msg).id(msg.id)
                    }
                    if model.isSending {
                        TypingIndicator()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .id(typingAnchor)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.lg)
                .padding(.bottom, Theme.Spacing.sm)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: model.messages) { _, _ in scrollToEnd(proxy) }
            .onChange(of: model.isSending) { _, _ in scrollToEnd(proxy) }
        }
    }

    private let typingAnchor = "typing-anchor"

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            if model.isSending {
                proxy.scrollTo(typingAnchor, anchor: .bottom)
            } else if let last = model.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }

    // MARK: Empty state

    private var emptyState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(Theme.blue)
                    Text("Ask about your money")
                        .font(.hiveBody(20, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Text("Spending, budgets, points, and trends — grounded in your linked accounts.")
                        .font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(spacing: Theme.Spacing.sm) {
                    ForEach(model.suggestions, id: \.self) { prompt in
                        Button {
                            Haptics.selection()
                            Task { await model.send(prompt) }
                        } label: {
                            HStack {
                                Text(prompt)
                                    .font(.hiveBody(14, weight: .medium))
                                    .foregroundStyle(Theme.inkPrimary)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: Theme.Spacing.sm)
                                Image(systemName: "arrow.up.right")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Theme.inkTertiary)
                            }
                            .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget, alignment: .leading)
                            .padding(.horizontal, Theme.Spacing.md)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                                .stroke(Theme.borderDefault, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.top, Theme.Spacing.xxl)
        }
    }

    // MARK: Composer

    private var composer: some View {
        VStack(spacing: 0) {
            if let err = model.errorText {
                errorBanner(err)
            }
            HStack(alignment: .bottom, spacing: Theme.Spacing.sm) {
                TextField("Ask a question…", text: $draft, axis: .vertical)
                    .font(.hiveBody(15))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1...5)
                    .focused($composerFocused)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, 10)
                    .background(Theme.elevated)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                        .stroke(Theme.borderDefault, lineWidth: 1))

                Button {
                    let text = draft
                    draft = ""
                    Task { await model.send(text) }
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(canSend ? Theme.base : Theme.inkGhost)
                        .frame(width: 36, height: 36)
                        .background(canSend ? Theme.blue : Theme.elevated, in: Circle())
                }
                .disabled(!canSend)
                .accessibilityLabel("Send message")
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.sm)
        }
        .background(.bar)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isSending
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12)).foregroundStyle(Theme.warning)
            Text(text).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            if model.proGateHit {
                Button {
                    Haptics.selection(); showPaywall = true
                } label: {
                    Text("Upgrade")
                        .font(.hiveBody(12, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
                .accessibilityLabel("Upgrade to Pro")
            }
            Button { model.errorText = nil; model.proGateHit = false } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.inkTertiary)
            }
            .accessibilityLabel("Dismiss error")
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.sm)
        .background(Theme.surface)
    }

    // MARK: Model menu

    private var modelMenu: some View {
        Menu {
            Picker("Model", selection: $model.useClaude) {
                Text("Local (Ollama)").tag(false)
                Text("Claude (Pro)").tag(true)
            }
        } label: {
            Image(systemName: "cpu")
                .foregroundStyle(Theme.inkSecondary)
        }
        .accessibilityLabel("Choose AI model")
    }
}

// MARK: - Bubble

private struct ChatBubble: View {
    let message: ChatMessageDTO

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: Theme.Spacing.xl) }
            Text(message.content)
                .font(.hiveBody(15))
                .foregroundStyle(isUser ? Theme.base : Theme.inkPrimary)
                .textSelection(.enabled)
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.sm)
                .background(isUser ? Theme.blue : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                        .stroke(isUser ? .clear : Theme.borderDefault, lineWidth: 1)
                )
            if !isUser { Spacer(minLength: Theme.Spacing.xl) }
        }
    }
}

// MARK: - Typing indicator

private struct TypingIndicator: View {
    @State private var phase = 0.0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { i in
                Circle()
                    .fill(Theme.inkTertiary)
                    .frame(width: 6, height: 6)
                    .opacity(opacity(for: i))
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm + 2)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
            .stroke(Theme.borderDefault, lineWidth: 1))
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: false)) {
                phase = 3
            }
        }
        .accessibilityLabel("Assistant is typing")
    }

    private func opacity(for i: Int) -> Double {
        let p = (phase + Double(i)).truncatingRemainder(dividingBy: 3)
        return 0.3 + 0.7 * (1 - abs(p - 1.5) / 1.5)
    }
}
