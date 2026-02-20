import SwiftUI
import AuthenticationServices

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

    struct AuthResponse: Decodable {
        let accessToken: String
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
        await KeychainService.shared.clearAll()
        isAuthenticated = false
    }

    // MARK: - Private

    private func authenticate(provider: String, idToken: String) async {
        isLoading = true
        error = nil

        do {
            let body = ["idToken": idToken, "provider": provider]
            let response: AuthResponse = try await APIClient.shared.post(
                path: "/auth/\(provider)",
                body: body,
                authenticated: false
            )

            await KeychainService.shared.setAccessToken(response.accessToken)
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
