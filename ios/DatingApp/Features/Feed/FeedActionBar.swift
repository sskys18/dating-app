import SwiftUI

struct FeedActionBar: View {
    let likeQuota: LikeQuota?
    let onPass: () -> Void
    let onLike: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 40) {
                // Pass button
                Button(action: onPass) {
                    Image(systemName: "xmark")
                        .font(.title.bold())
                        .foregroundStyle(.gray)
                        .frame(width: 60, height: 60)
                        .background(Circle().fill(.white).shadow(radius: 3))
                }

                // Like button
                Button(action: onLike) {
                    Image(systemName: "heart.fill")
                        .font(.title.bold())
                        .foregroundStyle(.pink)
                        .frame(width: 70, height: 70)
                        .background(Circle().fill(.white).shadow(radius: 3))
                }
                .disabled(isQuotaExhausted)
                .opacity(isQuotaExhausted ? 0.5 : 1.0)
            }

            if let quota = likeQuota {
                if let max = quota.quota {
                    if quota.used >= max {
                        NavigationLink {
                            PaywallView()
                        } label: {
                            Text("No likes left. Upgrade!")
                                .font(.caption.bold())
                                .foregroundStyle(.pink)
                        }
                    } else {
                        Text("\(quota.used)/\(max) likes used")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Unlimited likes")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var isQuotaExhausted: Bool {
        guard let quota = likeQuota, let max = quota.quota else { return false }
        return quota.used >= max
    }
}
