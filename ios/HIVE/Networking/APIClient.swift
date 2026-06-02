import Foundation

/// The one path every backend call goes through. Owns base URL joining, Bearer
/// injection from the Keychain, status→`APIError` mapping, and JSON decoding.
///
/// An `actor` so concurrent screens can hit it safely; it holds no mutable money
/// state — totals are always server-authoritative and merely passed through.
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared) {
        self.session = session

        let dec = JSONDecoder()
        // Backend uses snake_case field names.
        dec.keyDecodingStrategy = .convertFromSnakeCase
        // ISO-8601 timestamps from the API.
        dec.dateDecodingStrategy = .iso8601
        self.decoder = dec

        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        enc.dateEncodingStrategy = .iso8601
        self.encoder = enc
    }

    // MARK: Request building

    private func makeRequest(_ endpoint: Endpoint) throws -> URLRequest {
        var components = URLComponents(
            url: APIEnvironment.baseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        )
        if !endpoint.query.isEmpty { components?.queryItems = endpoint.query }
        guard let url = components?.url else { throw APIError.network }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if endpoint.requiresAuth {
            guard let token = KeychainStore.get(.sessionToken) else {
                throw APIError.notAuthenticated
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    // MARK: Public API

    /// Send a request expecting a decodable JSON body.
    func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        let data = try await sendRaw(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    /// Send a request with a `Encodable` body, expecting a decodable response.
    func send<Body: Encodable, T: Decodable>(
        _ endpoint: Endpoint, body: Body, as type: T.Type
    ) async throws -> T {
        var ep = endpoint
        ep.body = try encoder.encode(body)
        return try await send(ep, as: T.self)
    }

    /// Send a request where the response body is ignored (e.g. 204).
    @discardableResult
    func sendVoid(_ endpoint: Endpoint) async throws -> Void {
        _ = try await sendRaw(endpoint)
    }

    /// Send a request with an `Encodable` body, ignoring any response body.
    func send<Body: Encodable>(_ endpoint: Endpoint, body: Body) async throws {
        var ep = endpoint
        ep.body = try encoder.encode(body)
        _ = try await sendRaw(ep)
    }

    // MARK: Transport

    private func sendRaw(_ endpoint: Endpoint) async throws -> Data {
        let request = try makeRequest(endpoint)
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .cancelled {
            throw APIError.cancelled
        } catch {
            throw APIError.network
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        switch http.statusCode {
        case 200...299:
            return data
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 402:
            throw APIError.paymentRequired
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.server(status: http.statusCode)
        default:
            throw APIError.server(status: http.statusCode)
        }
    }
}
