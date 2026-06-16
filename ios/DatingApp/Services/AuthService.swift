import SwiftUI
import AuthenticationServices
import Security

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

    /// Retained for the duration of an in-flight web OAuth flow.
    private var webAuthSession: WebAuthenticationSession?

    enum WebOAuthError: LocalizedError {
        case notConfigured(String)
        case stateMismatch
        case missingResponseParameter(String)
        case providerError(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured(let provider):
                return "\(provider) sign-in is not configured. Set its client ID in OAuthConfig."
            case .stateMismatch:
                return "Sign-in response failed a security check. Please try again."
            case .missingResponseParameter(let name):
                return "Sign-in response was missing \(name)."
            case .providerError(let message):
                return message
            }
        }
    }

    struct AuthResponse: Decodable {
        let accessToken: String
        let refreshToken: String?
        let expiresIn: Int
        let user: UserInfo
    }

    struct UserInfo: Decodable {
        let id: String
        let email: String?
        let nickname: String?
        let profileComplete: Bool
        let role: String
    }

    // MARK: - Apple Sign In

    func signInWithApple(authorization: ASAuthorization) async {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityToken = credential.identityToken,
              let tokenString = String(data: identityToken, encoding: .utf8)
        else {
            error = "Failed to get Apple ID credential"
            return
        }

        await authenticate(provider: "apple", idToken: tokenString)
    }

    // MARK: - Google Sign In

    /// OpenID Connect implicit flow: request an `id_token` directly so we can
    /// hand it to `POST /api/auth/google`, which verifies it via Google's
    /// `verifyIdToken`. State + nonce guard against CSRF / replay.
    func signInWithGoogle() async {
        guard !OAuthConfig.Google.clientID.isEmpty else {
            error = WebOAuthError.notConfigured("Google").localizedDescription
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let state = Self.randomURLSafeString()
            let nonce = Self.randomURLSafeString()

            var components = URLComponents(string: OAuthConfig.Google.authorizeURL)!
            components.queryItems = [
                URLQueryItem(name: "client_id", value: OAuthConfig.Google.clientID),
                URLQueryItem(name: "redirect_uri", value: OAuthConfig.Google.redirectURI),
                URLQueryItem(name: "response_type", value: "id_token"),
                URLQueryItem(name: "scope", value: OAuthConfig.Google.scope),
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "nonce", value: nonce),
            ]

            guard let authorizeURL = components.url else {
                throw WebOAuthError.providerError("Could not build the Google authorization URL.")
            }

            let session = WebAuthenticationSession()
            webAuthSession = session
            defer { webAuthSession = nil }

            let callbackURL = try await session.authenticate(
                authorizeURL: authorizeURL,
                callbackScheme: OAuthConfig.Google.callbackScheme
            )

            // Google's implicit flow returns the result in the URL fragment.
            let params = Self.parameters(encodedQuery: callbackURL.fragment)

            if let providerError = params["error"] {
                throw WebOAuthError.providerError("Google returned an error: \(providerError)")
            }
            guard params["state"] == state else {
                throw WebOAuthError.stateMismatch
            }
            guard let idToken = params["id_token"] else {
                throw WebOAuthError.missingResponseParameter("id_token")
            }

            await authenticate(provider: "google", idToken: idToken)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Kakao Sign In

    /// Authorization-code flow: capture `code` from the redirect, exchange it at
    /// Kakao's token endpoint for an access token, then send that access token to
    /// `POST /api/auth/kakao` — the backend validates it against
    /// `kapi.kakao.com/v2/user/me`.
    func signInWithKakao() async {
        guard !OAuthConfig.Kakao.clientID.isEmpty else {
            error = WebOAuthError.notConfigured("Kakao").localizedDescription
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let state = Self.randomURLSafeString()

            var components = URLComponents(string: OAuthConfig.Kakao.authorizeURL)!
            components.queryItems = [
                URLQueryItem(name: "client_id", value: OAuthConfig.Kakao.clientID),
                URLQueryItem(name: "redirect_uri", value: OAuthConfig.Kakao.redirectURI),
                URLQueryItem(name: "response_type", value: "code"),
                URLQueryItem(name: "state", value: state),
            ]

            guard let authorizeURL = components.url else {
                throw WebOAuthError.providerError("Could not build the Kakao authorization URL.")
            }

            let session = WebAuthenticationSession()
            webAuthSession = session
            defer { webAuthSession = nil }

            let callbackURL = try await session.authenticate(
                authorizeURL: authorizeURL,
                callbackScheme: OAuthConfig.callbackScheme
            )

            // Kakao's code flow returns the result in the query string.
            let params = Self.parameters(encodedQuery: callbackURL.query)

            if let providerError = params["error"] {
                throw WebOAuthError.providerError("Kakao returned an error: \(providerError)")
            }
            guard params["state"] == state else {
                throw WebOAuthError.stateMismatch
            }
            guard let code = params["code"] else {
                throw WebOAuthError.missingResponseParameter("code")
            }

            let accessToken = try await exchangeKakaoCodeForAccessToken(code)

            // The backend's Kakao verifier expects an access token in `idToken`.
            await authenticate(provider: "kakao", idToken: accessToken)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Exchanges a Kakao authorization `code` for an access token. Native apps
    /// with "client secret" disabled in the Kakao console send no secret.
    private func exchangeKakaoCodeForAccessToken(_ code: String) async throws -> String {
        guard let url = URL(string: OAuthConfig.Kakao.tokenURL) else {
            throw WebOAuthError.providerError("Invalid Kakao token endpoint.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "application/x-www-form-urlencoded;charset=utf-8",
            forHTTPHeaderField: "Content-Type"
        )

        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "client_id", value: OAuthConfig.Kakao.clientID),
            URLQueryItem(name: "redirect_uri", value: OAuthConfig.Kakao.redirectURI),
            URLQueryItem(name: "code", value: code),
        ]
        request.httpBody = form.percentEncodedQuery?.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw WebOAuthError.providerError("Kakao token exchange failed: \(body)")
        }

        struct KakaoTokenResponse: Decodable {
            let accessToken: String
            enum CodingKeys: String, CodingKey {
                case accessToken = "access_token"
            }
        }

        do {
            let token = try JSONDecoder().decode(KakaoTokenResponse.self, from: data)
            return token.accessToken
        } catch {
            throw WebOAuthError.missingResponseParameter("access_token")
        }
    }

    // MARK: - OAuth helpers

    /// URL-safe random string used for both `state` (CSRF) and `nonce` (replay).
    private static func randomURLSafeString(byteCount: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        if status != errSecSuccess {
            // Fallback: SecRandom should never fail, but UUIDs keep us non-blocking.
            bytes = Array("\(UUID().uuidString)\(UUID().uuidString)".utf8)
        }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Parses `key=value&key=value` from a percent-encoded query or fragment
    /// string. Google's implicit flow returns params in the URL fragment; Kakao's
    /// code flow returns them in the query — both have the same shape.
    private static func parameters(encodedQuery: String?) -> [String: String] {
        guard let encodedQuery = encodedQuery else { return [:] }
        var components = URLComponents()
        components.percentEncodedQuery = encodedQuery
        return Dictionary(
            (components.queryItems ?? []).compactMap { item in
                item.value.map { (item.name, $0) }
            },
            uniquingKeysWith: { first, _ in first }
        )
    }

    // MARK: - Logout

    func logout() async {
        if let refreshToken = await KeychainService.shared.getRefreshToken() {
            let body = ["refreshToken": refreshToken]
            let _: EmptyResponse? = try? await APIClient.shared.post(
                path: "/auth/logout",
                body: body
            )
        }
        await KeychainService.shared.clearAll()
        isAuthenticated = false
    }

    // MARK: - Session Management

    func checkExistingSession() async {
        if let _ = await KeychainService.shared.getAccessToken() {
            isAuthenticated = true
        } else if let _ = await KeychainService.shared.getRefreshToken() {
            let refreshed = await refreshTokenIfNeeded()
            isAuthenticated = refreshed
        }
    }

    func refreshTokenIfNeeded() async -> Bool {
        guard let refreshToken = await KeychainService.shared.getRefreshToken() else {
            return false
        }
        do {
            let body = ["refreshToken": refreshToken]
            let response: AuthResponse = try await APIClient.shared.post(
                path: "/auth/refresh?platform=ios",
                body: body,
                authenticated: false
            )
            await KeychainService.shared.setAccessToken(response.accessToken)
            if let newRefreshToken = response.refreshToken {
                await KeychainService.shared.setRefreshToken(newRefreshToken)
            }
            return true
        } catch {
            return false
        }
    }

    private struct EmptyResponse: Decodable {}

    // MARK: - Private

    private func authenticate(provider: String, idToken: String) async {
        isLoading = true
        error = nil

        do {
            let body = ["idToken": idToken, "provider": provider]
            let response: AuthResponse = try await APIClient.shared.post(
                path: "/auth/\(provider)?platform=ios",
                body: body,
                authenticated: false
            )

            await KeychainService.shared.setAccessToken(response.accessToken)
            if let refreshToken = response.refreshToken {
                await KeychainService.shared.setRefreshToken(refreshToken)
            }
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
