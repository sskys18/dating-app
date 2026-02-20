import SwiftUI
import StoreKit

struct PaywallView: View {
    @EnvironmentObject var subscriptionService: SubscriptionService
    @EnvironmentObject var entitlementService: EntitlementService
    @State private var billingPeriod: BillingPeriod = .monthly
    @State private var purchaseError: String?

    enum BillingPeriod: String, CaseIterable {
        case monthly = "Monthly"
        case yearly = "Yearly"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Current plan badge
                currentPlanBadge

                // Billing period toggle
                Picker("Billing", selection: $billingPeriod) {
                    ForEach(BillingPeriod.allCases, id: \.self) { period in
                        Text(period.rawValue).tag(period)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Plus tier
                tierCard(
                    name: "Plus",
                    color: .blue,
                    product: productForTier("plus"),
                    features: [
                        "Full feed access",
                        "Unlimited likes",
                        "Rewind last swipe",
                        "Advanced preferences"
                    ]
                )

                // Premium tier
                tierCard(
                    name: "Premium",
                    color: .purple,
                    product: productForTier("premium"),
                    features: [
                        "Everything in Plus",
                        "See who likes you",
                        "Incognito mode",
                        "Travel mode",
                        "Priority likes"
                    ]
                )

                // Comparison
                VStack(alignment: .leading, spacing: 8) {
                    Text("Compare Plans")
                        .font(.headline)
                        .padding(.horizontal)
                    PlanComparisonView()
                }
                .padding(.top, 8)

                // Restore purchases
                Button("Restore Purchases") {
                    Task {
                        do {
                            try await subscriptionService.restorePurchases()
                            await entitlementService.forceRefresh()
                        } catch {
                            purchaseError = error.localizedDescription
                        }
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.bottom, 24)
            }
            .padding(.top)
        }
        .navigationTitle("Upgrade")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await subscriptionService.loadProducts()
        }
        .alert("Error", isPresented: .init(
            get: { purchaseError != nil },
            set: { if !$0 { purchaseError = nil } }
        )) {
            Button("OK") { purchaseError = nil }
        } message: {
            Text(purchaseError ?? "")
        }
    }

    private var currentPlanBadge: some View {
        HStack {
            Text("Current Plan:")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(entitlementService.entitlement.plan.rawValue.capitalized)
                .font(.subheadline.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(planBadgeColor.opacity(0.15))
                .foregroundStyle(planBadgeColor)
                .clipShape(Capsule())
        }
    }

    private var planBadgeColor: Color {
        switch entitlementService.entitlement.plan {
        case .free: return .gray
        case .plus: return .blue
        case .premium: return .purple
        }
    }

    private func productForTier(_ tier: String) -> Product? {
        let suffix = billingPeriod == .monthly ? "monthly" : "yearly"
        return subscriptionService.products.first { $0.id == "\(tier)_\(suffix)" }
    }

    private func tierCard(name: String, color: Color, product: Product?, features: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(name)
                    .font(.title3.bold())
                    .foregroundStyle(color)
                Spacer()
                if let product {
                    Text(product.displayPrice)
                        .font(.title3.bold())
                    Text("/ \(billingPeriod == .monthly ? "mo" : "yr")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            ForEach(features, id: \.self) { feature in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                        .foregroundStyle(color)
                    Text(feature)
                        .font(.subheadline)
                }
            }

            Button {
                guard let product else { return }
                Task {
                    do {
                        let purchased = try await subscriptionService.purchase(product)
                        if purchased {
                            await entitlementService.forceRefresh()
                        }
                    } catch {
                        purchaseError = error.localizedDescription
                    }
                }
            } label: {
                Text("Subscribe to \(name)")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(color)
            .disabled(product == nil)
        }
        .padding()
        .background(color.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }
}
