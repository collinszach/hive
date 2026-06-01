import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// A typed description of one backend call. Screens build these and hand them to
/// `APIClient`; the client owns base URL, auth, and decoding.
struct Endpoint {
    var method: HTTPMethod = .get
    /// Path beginning with `/api/...` — joined onto the environment base URL.
    var path: String
    var query: [URLQueryItem] = []
    var body: Data? = nil
    /// When false, the request is sent without the Bearer header (e.g. native auth).
    var requiresAuth: Bool = true

    static func get(_ path: String, query: [URLQueryItem] = []) -> Endpoint {
        Endpoint(method: .get, path: path, query: query)
    }

    static func post(_ path: String, query: [URLQueryItem] = []) -> Endpoint {
        Endpoint(method: .post, path: path, query: query)
    }
}

/// Backend environment. Single source of truth for the base URL.
enum APIEnvironment {
    static let baseURL = URL(string: "https://hive.zacharyjcollins.com")!
}
