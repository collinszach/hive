import SwiftUI

/// The four states every data-backed screen moves through. View models expose a
/// `LoadState<T>` and views render it with `LoadStateView`, so the loading →
/// empty → error → success contract is identical everywhere.
enum LoadState<Value> {
    case loading
    case loaded(Value)
    case empty
    case failed(APIError)
}

extension LoadState {
    var value: Value? {
        if case let .loaded(v) = self { return v }
        return nil
    }
}

/// Renders a `LoadState`: a layout-matched skeleton while loading, a purposeful
/// empty state, an error state with retry, or the content.
struct LoadStateView<Value, Content: View, Skeleton: View>: View {
    let state: LoadState<Value>
    var emptyTitle: String = "Nothing here yet"
    var emptyMessage: String = ""
    var emptyIcon: String = "tray"
    /// Optional CTA shown on the empty state (e.g. "Add a budget"): (title, action).
    var emptyAction: (String, () -> Void)? = nil
    let onRetry: () -> Void
    @ViewBuilder let content: (Value) -> Content
    @ViewBuilder let skeleton: () -> Skeleton

    var body: some View {
        switch state {
        case .loading:
            skeleton()
        case .loaded(let value):
            content(value)
        case .empty:
            EmptyStateView(
                icon: emptyIcon, title: emptyTitle, message: emptyMessage,
                actionTitle: emptyAction?.0, action: emptyAction?.1
            )
        case .failed(let error):
            ErrorStateView(error: error, onRetry: error.isRetryable ? onRetry : nil)
        }
    }
}
