import Foundation

/// Static OAuth client configuration for the web-based providers (Google, Kakao).
///
/// Apple sign-in needs none of this — it goes through `SignInWithAppleButton` /
/// `ASAuthorization` and never touches `ASWebAuthenticationSession`.
///
/// ⚠️ Before shipping, replace the placeholder client IDs below with the real
/// values from the Google Cloud console (iOS OAuth client) and the Kakao
/// developers console (REST/Native app key). They are intentionally empty so a
/// misconfigured build fails loudly at sign-in time instead of silently hitting
/// the provider with a blank `client_id`.
enum OAuthConfig {

    // MARK: - Callback scheme

    /// Custom URL scheme used as the `ASWebAuthenticationSession` callback.
    ///
    /// Custom-scheme callbacks are intercepted by the session directly, so this
    /// does NOT need to be registered as a `CFBundleURLScheme` in Info.plist.
    /// (`onOpenURL` / Universal Links are unaffected.)
    static let callbackScheme = "com.datingapp.app.oauth"

    // MARK: - Google (OpenID Connect implicit flow → id_token)

    enum Google {
        /// iOS OAuth client ID, e.g. "1234567890-abcdef.apps.googleusercontent.com".
        static let clientID = ""

        /// Authorization endpoint.
        static let authorizeURL = "https://accounts.google.com/o/oauth2/v2/auth"

        /// Google requires the redirect URI for an iOS client to be the
        /// reversed client ID followed by a path. We derive it from `clientID`
        /// so the two never drift apart.
        static var redirectURI: String {
            "\(reversedClientID):/oauth2redirect/google"
        }

        /// The callback scheme `ASWebAuthenticationSession` must listen for —
        /// the scheme portion of `redirectURI` (the reversed client ID).
        static var callbackScheme: String { reversedClientID }

        /// "com.googleusercontent.apps.1234567890-abcdef" form expected by Google.
        static var reversedClientID: String {
            let trimmed = clientID.replacingOccurrences(
                of: ".apps.googleusercontent.com",
                with: ""
            )
            return "com.googleusercontent.apps.\(trimmed)"
        }

        static let scope = "openid email profile"
    }

    // MARK: - Kakao (authorization-code flow → access token)

    enum Kakao {
        /// Kakao REST API key (used as `client_id`).
        static let clientID = ""

        static let authorizeURL = "https://kauth.kakao.com/oauth/authorize"
        static let tokenURL = "https://kauth.kakao.com/oauth/token"

        /// Must exactly match a redirect URI registered in the Kakao console.
        /// We use the app's custom scheme so the session can intercept it.
        static let redirectURI = "\(callbackScheme)://oauth2redirect/kakao"
    }
}
