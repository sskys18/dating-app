import SwiftUI
import Combine

enum AppRoute {
    case splash
    case auth
    case handoffClaim(token: String)
    case profileSetup
    case main
}

@MainActor
class AppState: ObservableObject {
    @Published var currentRoute: AppRoute = .splash
    @Published var isAuthenticated = false
    @Published var isProfileComplete = false
    @Published var pendingHandoffToken: String?
    @Published var userProfile: UserProfile?

    func resolveRoute() {
        if isAuthenticated, let token = pendingHandoffToken {
            pendingHandoffToken = nil
            currentRoute = .handoffClaim(token: token)
        } else if !isAuthenticated {
            currentRoute = .auth
        } else if !isProfileComplete {
            currentRoute = .profileSetup
        } else {
            currentRoute = .main
        }
    }
}
