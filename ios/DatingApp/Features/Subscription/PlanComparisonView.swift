import SwiftUI

struct PlanComparisonView: View {
    private struct FeatureRow {
        let name: String
        let free: String
        let plus: String
        let premium: String
    }

    private let features: [FeatureRow] = [
        FeatureRow(name: "Daily Likes", free: "5", plus: "Unlimited", premium: "Unlimited"),
        FeatureRow(name: "Full Feed", free: "--", plus: "Yes", premium: "Yes"),
        FeatureRow(name: "Rewind", free: "--", plus: "Yes", premium: "Yes"),
        FeatureRow(name: "Advanced Preferences", free: "--", plus: "Yes", premium: "Yes"),
        FeatureRow(name: "See Who Likes You", free: "--", plus: "--", premium: "Yes"),
        FeatureRow(name: "Incognito Mode", free: "--", plus: "--", premium: "Yes"),
        FeatureRow(name: "Travel Mode", free: "--", plus: "--", premium: "Yes"),
        FeatureRow(name: "Priority Likes", free: "--", plus: "--", premium: "Yes"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header row
            HStack {
                Text("Feature")
                    .font(.caption.bold())
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Free")
                    .font(.caption.bold())
                    .frame(width: 60)
                Text("Plus")
                    .font(.caption.bold())
                    .foregroundStyle(.blue)
                    .frame(width: 60)
                Text("Premium")
                    .font(.caption.bold())
                    .foregroundStyle(.purple)
                    .frame(width: 70)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.gray.opacity(0.1))

            // Feature rows
            ForEach(features, id: \.name) { feature in
                HStack {
                    Text(feature.name)
                        .font(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    cellView(feature.free)
                        .frame(width: 60)
                    cellView(feature.plus)
                        .frame(width: 60)
                    cellView(feature.premium)
                        .frame(width: 70)
                }
                .padding(.horizontal)
                .padding(.vertical, 6)

                Divider().padding(.horizontal)
            }
        }
    }

    @ViewBuilder
    private func cellView(_ value: String) -> some View {
        if value == "Yes" {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.caption)
        } else if value == "--" {
            Image(systemName: "minus")
                .foregroundStyle(.gray.opacity(0.4))
                .font(.caption)
        } else {
            Text(value)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
