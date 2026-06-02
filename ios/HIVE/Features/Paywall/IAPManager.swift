import Foundation
import StoreKit
import Observation

/// Owns the StoreKit 2 purchase lifecycle for HIVE's subscriptions and the hand-off to
/// the backend, which is the source of truth for entitlements.
///
/// Flow:
///  1. `loadProducts()` fetches the four subscription products from the App Store.
///  2. `purchase(_:)` runs the StoreKit purchase sheet, gets a verified `Transaction`,
///     and POSTs its `jwsRepresentation` to `/api/iap/apple/verify`. The backend
///     verifies the signature against Apple's root certs and writes the plan; we then
///     read `/api/billing/status` back so the UI reflects the server's truth.
///  3. A long-lived `Transaction.updates` listener catches renewals, Ask-to-Buy
///     approvals, and purchases made on other devices, syncing each to the backend.
///  4. `restore()` re-syncs `Transaction.currentEntitlements` (Apple-required button).
///
/// We deliberately do NOT grant entitlements client-side off StoreKit alone — the
/// server validates every JWS. This keeps a jailbroken/replayed transaction from
/// unlocking Pro.
@MainActor
@Observable
final class IAPManager {
    static let shared = IAPManager()

    /// Product IDs — MUST match `PRODUCT_TIERS` in `backend/app/iap/apple.py` and the
    /// products configured in App Store Connect.
    enum ProductID {
        static let starterMonthly = "com.zacharyjcollins.hive.starter.monthly"
        static let starterAnnual  = "com.zacharyjcollins.hive.starter.annual"
        static let proMonthly     = "com.zacharyjcollins.hive.pro.monthly"
        static let proAnnual      = "com.zacharyjcollins.hive.pro.annual"

        static let all: [String] = [starterMonthly, starterAnnual, proMonthly, proAnnual]
    }

    /// Fetched StoreKit products, ordered as in `ProductID.all` (starter then pro,
    /// monthly then annual). Empty until `loadProducts()` succeeds.
    private(set) var products: [Product] = []
    /// Latest entitlement as reported by the backend. Drives gating across the app.
    private(set) var billing: BillingStatus?
    /// True while a purchase or restore is in flight (drives spinners / disables).
    private(set) var isPurchasing = false
    /// True while products are loading (drives the paywall skeleton).
    private(set) var isLoadingProducts = false
    /// User-facing error from the last purchase/restore attempt, if any.
    private(set) var errorMessage: String?

    private let api: APIClient
    private var updatesTask: Task<Void, Never>?

    private init(api: APIClient = .shared) {
        self.api = api
    }

    /// Convenience accessors keyed to the plan they unlock.
    func product(_ id: String) -> Product? { products.first { $0.id == id } }
    var isPro: Bool { billing?.isPro ?? false }
    var isPaid: Bool { billing?.isPaid ?? false }

    // MARK: Lifecycle

    /// Start the transaction listener. Call once at app launch (after sign-in). Catches
    /// renewals and out-of-band purchases for the rest of the process lifetime.
    func startObserving() {
        guard updatesTask == nil else { return }
        updatesTask = Task(priority: .background) { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                if let txn = try? Self.checkVerified(update) {
                    await self.sync(jws: update.jwsRepresentation)
                    await txn.finish()
                }
            }
        }
    }

    // MARK: Products

    func loadProducts() async {
        isLoadingProducts = true
        defer { isLoadingProducts = false }
        do {
            let fetched = try await Product.products(for: ProductID.all)
            // Preserve our canonical ordering rather than StoreKit's.
            products = ProductID.all.compactMap { id in fetched.first { $0.id == id } }
        } catch {
            errorMessage = "Couldn't load subscription options. Check your connection and try again."
        }
    }

    // MARK: Purchase

    /// Run the purchase sheet for a product, then verify server-side. Returns true if
    /// the user ends the flow entitled (purchase succeeded and the backend confirmed).
    @discardableResult
    func purchase(_ product: Product) async -> Bool {
        errorMessage = nil
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let txn = try Self.checkVerified(verification)
                let ok = await sync(jws: verification.jwsRepresentation)
                await txn.finish()
                return ok
            case .userCancelled:
                return false
            case .pending:
                // Ask-to-Buy / SCA — the listener will pick it up once approved.
                errorMessage = "Your purchase is pending approval. It'll unlock automatically once approved."
                return false
            @unknown default:
                return false
            }
        } catch {
            errorMessage = "The purchase couldn't be completed. Please try again."
            return false
        }
    }

    /// Apple-required "Restore Purchases". Pushes the current StoreKit entitlement to
    /// the backend, then refreshes status. Returns true if the user is entitled after.
    @discardableResult
    func restore() async -> Bool {
        errorMessage = nil
        isPurchasing = true
        defer { isPurchasing = false }
        // Sync to App Store first so currentEntitlements is fresh.
        try? await AppStore.sync()
        var synced = false
        for await entitlement in Transaction.currentEntitlements {
            if (try? Self.checkVerified(entitlement)) != nil {
                _ = await sync(jws: entitlement.jwsRepresentation)
                synced = true
            }
        }
        if !synced {
            // Nothing to restore on the device; still refresh from the server in case
            // another source (Stripe) granted access.
            await refreshStatus()
            if !(billing?.isPaid ?? false) {
                errorMessage = "No active subscription was found to restore."
            }
        }
        return billing?.isPaid ?? false
    }

    // MARK: Backend hand-off

    /// POST a verified transaction's signed JWS to the backend, then read entitlement
    /// back. The JWS comes from the StoreKit `VerificationResult`, not the `Transaction`.
    @discardableResult
    private func sync(jws: String) async -> Bool {
        do {
            let body = AppleVerifyRequest(jws: jws)
            let status: BillingStatus = try await api.send(
                .post("/api/iap/apple/verify"), body: body, as: BillingStatus.self
            )
            billing = status
            return status.isPaid
        } catch {
            errorMessage = "We couldn't confirm your purchase with the server. Pull to refresh or try Restore."
            return false
        }
    }

    /// Read the canonical entitlement from the backend. Cheap; call on paywall appear.
    func refreshStatus() async {
        if let status = try? await api.send(.get("/api/billing/status"), as: BillingStatus.self) {
            billing = status
        }
    }

    // MARK: Verification

    /// Unwrap a StoreKit `VerificationResult`, throwing on an unverified payload.
    private static func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw IAPError.failedVerification
        case .verified(let safe):
            return safe
        }
    }

    enum IAPError: Error { case failedVerification }
}
