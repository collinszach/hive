import Foundation

/// Mirrors `GET /api/billing/status` from `backend/app/api/billing.py`. This is the
/// canonical read of the signed-in user's plan, used by the paywall and the Settings
/// "Plan" section to reflect the current entitlement after a purchase or renewal.
///
/// Decoding is tolerant: the self-hosted backend can lag the app, so newer/optional
/// fields default rather than failing the whole screen.
struct BillingStatus: Decodable {
    /// "free" | "starter" | "pro" (matches backend `PlanTier`).
    let plan: String
    /// Subscription status string — "active", "expired", "canceled", etc. Optional
    /// because a never-subscribed user may have it null.
    let status: String?
    /// ISO8601 end of the current paid period, if any.
    let periodEnd: String?
    /// Where the entitlement came from: "apple" | "stripe" | nil. Lets the paywall
    /// route the user to the right place to manage their subscription.
    let planSource: String?
    let claudeEnabled: Bool
    let snaptradeEnabled: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        plan = try c.decodeIfPresent(String.self, forKey: .plan) ?? "free"
        // `/api/billing/status` calls it `stripe_status`; `/api/iap/apple/verify`
        // returns it as `status`. Accept either so both responses decode here.
        status = try c.decodeIfPresent(String.self, forKey: .status)
            ?? c.decodeIfPresent(String.self, forKey: .stripeStatus)
        periodEnd = try c.decodeIfPresent(String.self, forKey: .periodEnd)
        planSource = try c.decodeIfPresent(String.self, forKey: .planSource)
        claudeEnabled = try c.decodeIfPresent(Bool.self, forKey: .claudeEnabled) ?? false
        snaptradeEnabled = try c.decodeIfPresent(Bool.self, forKey: .snaptradeEnabled) ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case plan, status, stripeStatus, periodEnd, planSource, claudeEnabled, snaptradeEnabled
    }

    var isPro: Bool { plan == "pro" }
    var isPaid: Bool { plan == "starter" || plan == "pro" }

    /// True when the active entitlement was bought through Apple — the only kind the
    /// iOS app can manage. Stripe-sourced plans are managed on the web.
    var managedByApple: Bool { planSource == "apple" }
}

/// Body for `POST /api/iap/apple/verify` — the StoreKit 2
/// `Transaction.jwsRepresentation` for the most recent entitlement.
struct AppleVerifyRequest: Encodable {
    let jws: String
}
