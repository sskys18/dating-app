import SwiftUI

@MainActor
class EntitlementService: ObservableObject {
    @Published var entitlement: Entitlement = .free

    private let cacheKey = "cached_entitlement"

    func loadCached() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        if let cached = try? decoder.decode(Entitlement.self, from: data) {
            entitlement = cached
        }
    }

    func fetchEntitlements() async {
        do {
            let result: Entitlement = try await APIClient.shared.get(
                path: "/subscription/entitlements"
            )
            entitlement = result
            saveToCache(result)
        } catch {
            // Keep cached value on failure
        }
    }

    func forceRefresh() async {
        UserDefaults.standard.removeObject(forKey: cacheKey)
        await fetchEntitlements()
    }

    var canViewFullFeed: Bool { entitlement.fullFeed }
    var canSeeWhoLikesYou: Bool { entitlement.likesYou }
    var currentDailyLikeQuota: Int? { entitlement.dailyLikeQuota }

    private func saveToCache(_ entitlement: Entitlement) {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        if let data = try? encoder.encode(entitlement) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }
}
