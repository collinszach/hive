import Foundation

// MARK: - AI Chat

/// One turn in the conversation. Sent back as history on each request and used to
/// render bubbles. `role` matches the backend's `Literal["user","assistant"]`.
/// Encoded with snake_case by the shared encoder (no field renames needed here).
struct ChatMessageDTO: Codable, Identifiable, Equatable {
    enum Role: String, Codable { case user, assistant }

    var id = UUID()
    let role: Role
    var content: String

    // Only role/content cross the wire; id is client-side.
    private enum CodingKeys: String, CodingKey { case role, content }
}

/// Body for `POST /api/chat`. `conversationHistory` → `conversation_history`,
/// `useClaude` → `use_claude` via the encoder's snake_case strategy.
struct ChatRequest: Encodable {
    let message: String
    let conversationHistory: [ChatMessageDTO]
    let useClaude: Bool
}

/// `POST /api/chat` response. `model_used` → `modelUsed` via snake_case decode.
struct ChatResponse: Decodable {
    let response: String
    let modelUsed: String
}
