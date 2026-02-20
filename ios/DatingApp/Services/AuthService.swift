import SwiftUI
import AuthenticationServices

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

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

    // MARK: - Google Sign In (placeholder)

    func signInWithGoogle() async {
        // Will use ASWebAuthenticationSession
        error = "Google sign-in not yet implemented"
    }

    // MARK: - Kakao Sign In (placeholder)

    func signInWithKakao() async {
        // Will use ASWebAuthenticationSession
        error = "Kakao sign-in not yet implemented"
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
