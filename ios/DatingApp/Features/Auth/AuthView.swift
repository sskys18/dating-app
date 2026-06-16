import SwiftUI
import AuthenticationServices

struct AuthView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Logo
            VStack(spacing: 12) {
                Image(systemName: "heart.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.pink)
                Text("Dating App")
                    .font(.largeTitle.bold())
                Text("Find your ideal match")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Auth Buttons
            VStack(spacing: 12) {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    switch result {
                    case .success(let authorization):
                        Task {
                            await authService.signInWithApple(authorization: authorization)
                            if authService.isAuthenticated {
                                appState.isAuthenticated = true
                                appState.resolveRoute()
                            }
                        }
                    case .failure:
                        break
                    }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 50)

                Button {
                    Task {
                        await authService.signInWithGoogle()
                        completeSignInIfAuthenticated()
                    }
                } label: {
                    HStack {
                        Image(systemName: "g.circle.fill")
                        Text("Continue with Google")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(.white)
                    .foregroundStyle(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                }

                Button {
                    Task {
                        await authService.signInWithKakao()
                        completeSignInIfAuthenticated()
                    }
                } label: {
                    HStack {
                        Image(systemName: "message.fill")
                        Text("Continue with Kakao")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.yellow)
                    .foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal, 24)

            if authService.isLoading {
                ProgressView()
            }

            if let error = authService.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Text("By continuing, you agree to our Terms of Service and Privacy Policy.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .padding(.bottom, 16)
        }
    }

    /// Mirrors the Apple button's success handling: once `AuthService` has stored
    /// tokens and flipped `isAuthenticated`, advance the app's route.
    private func completeSignInIfAuthenticated() {
        guard authService.isAuthenticated else { return }
        appState.isAuthenticated = true
        appState.resolveRoute()
    }
}
