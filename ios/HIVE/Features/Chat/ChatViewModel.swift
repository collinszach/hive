import SwiftUI
import Observation

/// Backs `ChatView` — the natural-language finance assistant over `POST /api/chat`.
/// The endpoint is single-response (no streaming): we append the user's message,
/// show a thinking indicator, then append the assistant's reply. History is sent
/// each turn so the model has context.
///
/// PII discipline: message bodies are never logged and the auth token is attached
/// by `APIClient` from the Keychain — it never appears in chat content or context.
@MainActor
@Observable
final class ChatViewModel {
    private(set) var messages: [ChatMessageDTO] = []
    /// True while a reply is in flight — drives the typing indicator and disables send.
    private(set) var isSending = false
    /// Transient, dismissible error banner text (nil = no error).
    var errorText: String?
    /// Set when the user hits the Pro-only gate (HTTP 402) — the error banner then
    /// offers an Upgrade affordance. Cleared when the banner is dismissed.
    var proGateHit = false
    /// Local (Ollama) by default; the self-hosted single-user case stays free/local.
    var useClaude = false

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    var isEmpty: Bool { messages.isEmpty }

    /// Starter questions shown on the empty state; tapping one sends it.
    let suggestions = [
        "How much did I spend on dining this month?",
        "What are my biggest expenses lately?",
        "Am I over budget anywhere?",
        "Which card earns the most on groceries?",
    ]

    func send(_ raw: String) async {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        errorText = nil
        messages.append(ChatMessageDTO(role: .user, content: text))
        isSending = true
        defer { isSending = false }

        // History excludes the just-added message; the backend takes it separately.
        let history = Array(messages.dropLast())
        do {
            let resp = try await api.send(
                .post("/api/chat"),
                body: ChatRequest(message: text, conversationHistory: history, useClaude: useClaude),
                as: ChatResponse.self
            )
            // Guard against a blank reply: the model occasionally returns whitespace-only
            // content, which would otherwise render as an empty bubble (looks like "no answer").
            let reply = resp.response.trimmingCharacters(in: .whitespacesAndNewlines)
            if reply.isEmpty {
                Haptics.error()
                errorText = "The assistant didn't return a reply. Try rephrasing, or switch models."
            } else {
                messages.append(ChatMessageDTO(role: .assistant, content: reply))
                Haptics.success()
            }
        } catch let error as APIError {
            handle(error)
        } catch {
            handle(.network)
        }
    }

    private func handle(_ error: APIError) {
        Haptics.error()
        switch error {
        case .paymentRequired:
            errorText = "Claude chat needs the Pro plan. Upgrade, or switch to Local to keep going."
            proGateHit = true
        case .server(let status) where status == 503:
            errorText = "The local AI (Ollama) is offline. Try again, or switch models."
        default:
            errorText = error.userMessage
        }
    }
}
