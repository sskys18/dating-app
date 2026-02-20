import StoreKit
import SwiftUI

@MainActor
class SubscriptionService: ObservableObject {
    @Published var products: [Product] = []
    @Published var isLoading = false
    @Published var error: String?

    private let productIDs = ["plus_monthly", "plus_yearly", "premium_monthly", "premium_yearly"]
    private var transactionListener: Task<Void, Never>?

    private struct VerifyBody: Encodable {
        let transactionId: String
    }

    private struct RestoreBody: Encodable {
        let transactionIds: [String]
    }

    func loadProducts() async {
        isLoading = true
        error = nil

        do {
            products = try await Product.products(for: productIDs)
                .sorted { $0.price < $1.price }
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func purchase(_ product: Product) async throws -> Bool {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)

            // Send to backend for server-side verification
            let body = VerifyBody(transactionId: String(transaction.originalID))
            let _: Entitlement = try await APIClient.shared.post(
                path: "/subscription/verify",
                body: body
            )

            await transaction.finish()
            return true

        case .userCancelled:
            return false

        case .pending:
            return false

        @unknown default:
            return false
        }
    }

    func restorePurchases() async throws {
        var transactionIds: [String] = []

        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result) {
                transactionIds.append(String(transaction.originalID))
            }
        }

        guard !transactionIds.isEmpty else {
            error = "No purchases found to restore"
            return
        }

        let body = RestoreBody(transactionIds: transactionIds)
        let _: Entitlement = try await APIClient.shared.post(
            path: "/subscription/restore",
            body: body
        )
    }

    func listenForTransactionUpdates() {
        transactionListener = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if let transaction = try? self?.checkVerified(result) {
                    let body = VerifyBody(transactionId: String(transaction.originalID))
                    let _: Entitlement? = try? await APIClient.shared.post(
                        path: "/subscription/verify",
                        body: body
                    )
                    await transaction.finish()
                }
            }
        }
    }

    deinit {
        transactionListener?.cancel()
    }

    private nonisolated func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }
}
