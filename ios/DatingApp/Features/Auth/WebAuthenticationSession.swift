import AuthenticationServices
import UIKit

/// Thin async wrapper around `ASWebAuthenticationSession`.
///
/// Drives a provider's web OAuth flow inside the system browser sheet, captures
/// the redirect to a custom scheme, and returns the callback URL. The class also
/// acts as its own `presentationContextProvider`, anchoring the sheet to the
/// app's foreground window.
@MainActor
final class WebAuthenticationSession: NSObject, ASWebAuthenticationPresentationContextProviding {

    enum WebAuthError: LocalizedError {
        case cancelled
        case missingCallbackURL
        case sessionStartFailed

        var errorDescription: String? {
            switch self {
            case .cancelled:
                return "Sign-in was cancelled."
            case .missingCallbackURL:
                return "Sign-in did not return a valid response."
            case .sessionStartFailed:
                return "Could not start the sign-in session."
            }
        }
    }

    /// Strong reference keeps the session alive for the duration of the flow;
    /// `ASWebAuthenticationSession` is otherwise not retained by the system.
    private var session: ASWebAuthenticationSession?

    /// Presents `authorizeURL` and resolves with the redirect `URL` whose scheme
    /// matches `callbackScheme`.
    func authenticate(
        authorizeURL: URL,
        callbackScheme: String,
        prefersEphemeral: Bool = false
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authorizeURL,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                if let error = error {
                    if let authError = error as? ASWebAuthenticationSessionError,
                       authError.code == .canceledLogin {
                        continuation.resume(throwing: WebAuthError.cancelled)
                    } else {
                        continuation.resume(throwing: error)
                    }
                    return
                }

                guard let callbackURL = callbackURL else {
                    continuation.resume(throwing: WebAuthError.missingCallbackURL)
                    return
                }

                continuation.resume(returning: callbackURL)
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = prefersEphemeral
            self.session = session

            if !session.start() {
                continuation.resume(throwing: WebAuthError.sessionStartFailed)
            }
        }
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    nonisolated func presentationAnchor(
        for session: ASWebAuthenticationSession
    ) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
                ?? UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .first

            return scene?.windows.first { $0.isKeyWindow }
                ?? scene?.windows.first
                ?? ASPresentationAnchor()
        }
    }
}
