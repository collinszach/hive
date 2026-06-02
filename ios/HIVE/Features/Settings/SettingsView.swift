import SwiftUI
import UIKit

/// Settings / Account surface. Reached from the Connect tab's toolbar gear. Owns the
/// account identity readout, sign-out, the Apple-required in-app account deletion, and
/// an About section. Security toggles (biometric lock) are placeholders until that
/// feature lands (FEATURE-SPEC 1.4).
struct SettingsView: View {
    @Environment(AppState.self) private var app
    @Environment(LockState.self) private var lock
    @State private var model = SettingsViewModel()
    @State private var push = PushManager.shared
    @State private var confirmingSignOut = false
    @State private var showDeleteSheet = false

    var body: some View {
        Screen(title: "Settings", refresh: { await model.load() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                accountSection.hiveEntrance(0)
                notificationsSection.hiveEntrance(1)
                securitySection.hiveEntrance(2)
                aboutSection.hiveEntrance(3)
                dangerSection.hiveEntrance(4)
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .task { if model.state.value == nil { await model.load() } }
        .task { await push.refreshStatus() }
        .confirmationDialog("Sign out of HIVE?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { app.signOut() }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(isPresented: $showDeleteSheet) {
            DeleteAccountSheet(model: model)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: Account

    private var accountSection: some View {
        section("Account") {
            switch model.state {
            case .loaded(let me):
                GroupedCard(data: accountRows(me)) { row in
                    infoRow(row.label, row.value)
                }
            case .failed(let error):
                Card { Text(error.userMessage).font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary) }
            default:
                SkeletonBlock(height: 132, cornerRadius: Theme.Radius.card)
            }
        }
    }

    private struct InfoRow: Identifiable { let id = UUID(); let label: String; let value: String }

    private func accountRows(_ me: MeResponse) -> [InfoRow] {
        var rows = [InfoRow(label: "Account", value: me.username),
                    InfoRow(label: "Role", value: me.role.capitalized)]
        if let last = me.lastLoginAt {
            rows.append(InfoRow(label: "Last sign-in", value: Self.dateFormatter.string(from: last)))
        }
        return rows
    }

    // MARK: Notifications — push opt-in (FEATURE-SPEC 2.2)

    @ViewBuilder
    private var notificationsSection: some View {
        section("Notifications") {
            switch push.status {
            case .authorized, .provisional, .ephemeral:
                Card(padding: Theme.Spacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Push notifications")
                                .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                            Text("Alerts for unusual charges and your weekly recap")
                                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18)).foregroundStyle(Theme.income)
                    }
                    .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
                }
            case .denied:
                Card(padding: Theme.Spacing.md) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                        Text("Notifications are turned off")
                            .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                        Text("Turn them on in iOS Settings to get alerts for unusual charges and your weekly recap.")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                        Button("Open Settings") { openSystemSettings() }
                            .font(.hiveBody(14, weight: .medium))
                            .foregroundStyle(Theme.blue)
                            .frame(minHeight: Theme.minTouchTarget, alignment: .leading)
                    }
                }
            default: // notDetermined
                Card(padding: Theme.Spacing.md) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                        Text("Stay on top of your money")
                            .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                        Text("Get a heads-up when we spot an unusual charge, plus a weekly recap of what changed.")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                        Button("Turn on notifications") {
                            Haptics.selection()
                            Task { await push.requestAuthorization() }
                        }
                        .font(.hiveBody(14, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                        .frame(minHeight: Theme.minTouchTarget, alignment: .leading)
                    }
                }
            }
        }
    }

    private func openSystemSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    // MARK: Security — biometric app-lock (FEATURE-SPEC 1.4)

    private var lockBinding: Binding<Bool> {
        Binding(get: { lock.isEnabled }, set: { on in Task { await lock.setEnabled(on) } })
    }

    @ViewBuilder
    private var securitySection: some View {
        section("Security") {
            if lock.isBiometryAvailable {
                VStack(spacing: Theme.Spacing.md) {
                    Card(padding: Theme.Spacing.md) {
                        Toggle(isOn: lockBinding) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(lock.biometryLabel) lock")
                                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                                Text("Require \(lock.biometryLabel) when reopening HIVE")
                                    .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .tint(Theme.blue)
                    }
                    if lock.isEnabled {
                        Card(padding: Theme.Spacing.md) {
                            Picker("Re-lock after", selection: timeoutBinding) {
                                Text("Immediately").tag(0)
                                Text("After 1 minute").tag(1)
                                Text("After 5 minutes").tag(5)
                                Text("After 15 minutes").tag(15)
                            }
                            .pickerStyle(.menu)
                            .tint(Theme.blue)
                            .font(.hiveBody(15))
                        }
                    }
                }
            } else {
                GroupedCard(data: [InfoRow(label: "App lock", value: "Set up Face ID in iOS Settings")]) { row in
                    HStack {
                        Text(row.label).font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                        Spacer()
                        Text(row.value).font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                    }
                    .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
                }
            }
        }
    }

    private var timeoutBinding: Binding<Int> {
        Binding(get: { lock.timeoutMinutes }, set: { lock.timeoutMinutes = $0 })
    }

    // MARK: About

    private var aboutSection: some View {
        section("About") {
            GroupedCard(data: [InfoRow(label: "Version", value: Self.appVersion)]) { row in
                infoRow(row.label, row.value)
            }
        }
    }

    // MARK: Danger zone — sign out + delete

    private var dangerSection: some View {
        VStack(spacing: Theme.Spacing.md) {
            Button { confirmingSignOut = true } label: {
                Text("Sign out")
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
            }
            .buttonStyle(HiveSecondaryButtonStyle())

            Button(role: .destructive) {
                Haptics.warning(); showDeleteSheet = true
            } label: {
                Text("Delete account")
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.expense)
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
            }
            .buttonStyle(.plain)
            .disabled(model.username.isEmpty)

            Text("Deleting your account permanently removes your linked accounts, transactions, budgets, and points. This can't be undone.")
                .font(.hiveBody(12))
                .foregroundStyle(Theme.inkTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.md)
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: Building blocks

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(title).hiveLabelStyle().padding(.horizontal, Theme.Spacing.xs)
            content()
        }
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text(value).font(.hiveMono(14)).foregroundStyle(Theme.inkPrimary)
                .lineLimit(1).truncationMode(.middle)
        }
        .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .short
        return f
    }()

    private static var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(v) (\(b))"
    }
}

/// Confirmation sheet for the irreversible delete. The user must type their exact
/// account name; the confirm button stays disabled until it matches, and the request
/// runs through the view model (which signs out via AppState on success).
private struct DeleteAccountSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    @Bindable var model: SettingsViewModel
    @State private var typed = ""

    private var matches: Bool {
        typed.trimmingCharacters(in: .whitespaces) == model.username && !model.username.isEmpty
    }

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                        Label("Delete account", systemImage: "exclamationmark.triangle.fill")
                            .font(.hiveBody(18, weight: .semibold))
                            .foregroundStyle(Theme.expense)
                        Text("This permanently deletes your account and all linked financial data — accounts, transactions, budgets, splits, and points. This cannot be undone.")
                            .font(.hiveBody(14))
                            .foregroundStyle(Theme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text("Type \(model.username) to confirm")
                            .font(.hiveBody(13)).foregroundStyle(Theme.inkTertiary)
                        TextField("Account name", text: $typed)
                            .font(.hiveMono(15))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(Theme.Spacing.md)
                            .background(Theme.elevated)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                                .stroke(Theme.borderDefault, lineWidth: 1))
                    }

                    if let err = model.deleteError {
                        Text(err).font(.hiveBody(13)).foregroundStyle(Theme.expense)
                    }

                    Button {
                        Task {
                            // On success AppState flips to .signedOut and the root view
                            // swaps to sign-in, tearing down this sheet with it.
                            if await model.deleteAccount(confirm: typed, via: app) { dismiss() }
                        }
                    } label: {
                        HStack {
                            if model.isDeleting { ProgressView().tint(.white) }
                            Text(model.isDeleting ? "Deleting…" : "Delete my account")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(HiveDestructiveButtonStyle())
                    .disabled(!matches || model.isDeleting)
                    .opacity(matches ? 1 : 0.5)

                    Button("Cancel") { dismiss() }
                        .buttonStyle(HiveSecondaryButtonStyle())
                        .frame(maxWidth: .infinity)
                        .disabled(model.isDeleting)
                }
                .padding(Theme.Spacing.lg)
            }
        }
    }
}

/// Red-filled destructive button — only for irreversible actions (account deletion).
private struct HiveDestructiveButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.hiveBody(16, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Spacing.lg)
            .frame(minHeight: Theme.minTouchTarget)
            .background(Theme.expense)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
