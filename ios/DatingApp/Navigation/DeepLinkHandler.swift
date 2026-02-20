import Foundation
import Combine

class DeepLinkHandler: ObservableObject {
    static let shared = DeepLinkHandler()

    @Published var pendingHandoffToken: String?

    private init() {}

    func handle(url: URL) {
        // Universal link: https://yourdomain.com/handoff?token=xxx
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }

        if components.path == "/handoff",
           let token = components.queryItems?.first(where: { $0.name == "token" })?.value {
            pendingHandoffToken = token
        }
    }
}
