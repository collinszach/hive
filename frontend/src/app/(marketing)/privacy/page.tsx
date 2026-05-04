import { Shield } from "lucide-react";

export default function PrivacyPage() {
  const lastUpdated = "April 1, 2026";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Privacy Policy</h1>
        </div>
        <p className="text-sm text-slate-500">
          Last updated: {lastUpdated} · Saplyn (self-hosted personal finance platform)
        </p>
      </div>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">1. Overview</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Saplyn is a self-hosted, single-user personal finance platform. It is operated
          exclusively by and for the individual who deployed this instance on their own infrastructure.
          No data is shared with any third party except as necessary to operate the service (e.g.,
          Plaid for bank connectivity, Anthropic/Ollama for AI features).
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          Because this is a single-user deployment on private infrastructure, the &ldquo;operator&rdquo; and
          &ldquo;user&rdquo; are the same individual. This policy describes how data flows through the platform
          and your rights over that data.
        </p>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">2. Data We Collect</h2>
        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
          <p><strong className="text-slate-200">Financial data via Plaid:</strong> Transaction history, account balances, institution names, and account identifiers retrieved from your linked bank and credit card accounts. Plaid access tokens are stored encrypted at rest using AES-256 (Fernet).</p>
          <p><strong className="text-slate-200">Account credentials:</strong> Your Hive login username and bcrypt-hashed password. Plaintext passwords are never stored.</p>
          <p><strong className="text-slate-200">Authentication events:</strong> An audit log of login attempts, MFA events, and administrative actions, including IP address and timestamp.</p>
          <p><strong className="text-slate-200">AI chat history:</strong> Messages sent to the AI chat interface are processed by Anthropic Claude or a local Ollama model. Anthropic may process these according to their privacy policy. Local Ollama processing stays entirely on-device.</p>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">3. How Data Is Used</h2>
        <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside leading-relaxed">
          <li>Displaying your transaction history, spending analytics, and account balances</li>
          <li>Computing budget vs. actual spend, points earned, and net worth over time</li>
          <li>ML-based anomaly detection on transaction patterns (processed locally)</li>
          <li>Answering natural language questions about your finances via AI chat</li>
          <li>Generating spending forecasts using historical transaction data</li>
        </ul>
        <p className="text-sm text-slate-400 mt-2">
          Data is never used for advertising, profiling, or sold to third parties.
        </p>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">4. Data Retention</h2>
        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
          <p>
            Transaction data is retained for <strong className="text-slate-200">24 months</strong> by default,
            after which it may be automatically purged via the data retention policy. Budget and points
            history is retained indefinitely to support trend analysis. Audit logs are retained for
            <strong className="text-slate-200"> 12 months</strong>.
          </p>
          <p>
            You may request deletion of all financial data at any time from the{" "}
            <strong className="text-slate-200">Security Settings</strong> page. Deletion is immediate and irreversible.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">5. Data Security</h2>
        <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside leading-relaxed">
          <li>All network traffic encrypted via TLS 1.2+ (Tailscale + nginx)</li>
          <li>Access restricted to Tailscale VPN — no public internet exposure</li>
          <li>Plaid access tokens encrypted at rest with AES-256 (Fernet)</li>
          <li>Application login protected by bcrypt-hashed passwords and optional TOTP MFA</li>
          <li>PostgreSQL password-protected; Redis password-protected</li>
          <li>JWT session tokens with 12-hour expiry</li>
          <li>Role-based access control (RBAC) enforced on all API endpoints</li>
        </ul>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">6. Third-Party Services</h2>
        <div className="space-y-3 text-sm text-slate-400">
          <div className="rounded-lg bg-slate-800 px-4 py-3">
            <p className="font-medium text-slate-200">Plaid Technologies, Inc.</p>
            <p className="mt-1">Used for bank account connectivity. Plaid's privacy policy governs their data handling: <span className="text-indigo-400">plaid.com/legal/privacy-policy</span></p>
          </div>
          <div className="rounded-lg bg-slate-800 px-4 py-3">
            <p className="font-medium text-slate-200">Anthropic, PBC</p>
            <p className="mt-1">Used for AI chat features when Claude is selected. Only active chat messages are sent; no financial transaction data is transmitted. Governed by Anthropic's privacy policy.</p>
          </div>
          <div className="rounded-lg bg-slate-800 px-4 py-3">
            <p className="font-medium text-slate-200">Ollama (local)</p>
            <p className="mt-1">Local AI model processing. All data stays on-device. No external transmission.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">7. Your Rights</h2>
        <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside leading-relaxed">
          <li><strong className="text-slate-200">Access:</strong> All your data is visible within the Hive interface</li>
          <li><strong className="text-slate-200">Deletion:</strong> Delete all financial data at any time from Security Settings</li>
          <li><strong className="text-slate-200">Portability:</strong> Transaction data can be exported from the Transactions page</li>
          <li><strong className="text-slate-200">Correction:</strong> Transaction categories can be manually corrected inline</li>
          <li><strong className="text-slate-200">Disconnect:</strong> Any linked bank account can be unlinked at any time from Connect</li>
        </ul>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">8. Contact</h2>
        <p className="text-sm text-slate-400">
          This is a self-hosted personal deployment. The data controller is the individual operating
          this instance. For questions about this privacy policy, refer to the system administrator
          of this Hive instance.
        </p>
      </section>
    </div>
  );
}
