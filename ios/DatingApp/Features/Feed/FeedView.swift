import SwiftUI

struct FeedView: View {
    @EnvironmentObject var feedService: FeedService
    @EnvironmentObject var entitlementService: EntitlementService
    @StateObject private var viewModel = FeedViewModel()

    @State private var reportTarget: FeedCard?

    // IOS-04: free users see only a Top-3 preview; full feed is gated on the
    // server-confirmed `fullFeed` entitlement.
    private let freePreviewLimit = 3

    private var canViewFullFeed: Bool {
        entitlementService.canViewFullFeed
    }

    /// Remaining swipes allowed for a free user before the paywall (3 total, minus
    /// what they've already acted on). Derived from `viewModel.swipesTaken` so there's
    /// one source of truth for how much of the preview is left.
    private var remainingPreview: Int {
        max(0, freePreviewLimit - viewModel.swipesTaken)
    }

    /// Cards the user is allowed to swipe given their entitlement.
    private var visibleCards: [FeedCard] {
        canViewFullFeed ? feedService.cards : Array(feedService.cards.prefix(remainingPreview))
    }

    /// True when a free user has spent their Top-3 preview and the server has more feed to offer.
    private var isPreviewExhausted: Bool {
        !canViewFullFeed && remainingPreview == 0 && !feedService.cards.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                if isPreviewExhausted {
                    previewPaywall
                } else if visibleCards.isEmpty && !feedService.isLoading {
                    emptyState
                } else {
                    VStack {
                        premiumBar
                        Spacer()
                        cardStack
                        Spacer()
                        FeedActionBar(
                            likeQuota: feedService.likeQuota,
                            onPass: { performAction(like: false) },
                            onLike: { performAction(like: true) }
                        )
                        .padding(.bottom, 8)

                        if !canViewFullFeed {
                            previewFooter
                        }
                    }
                }

                if viewModel.showMatchAnimation, let matchedUser = viewModel.matchedUser {
                    MatchAnimationOverlay(
                        matchedUser: matchedUser,
                        chatRoomId: viewModel.matchedChatRoomId,
                        onSendMessage: {
                            viewModel.dismissMatch()
                        },
                        onKeepSwiping: {
                            viewModel.dismissMatch()
                        }
                    )
                }
            }
            .navigationTitle("Discover")
            .sheet(item: $reportTarget) { card in
                ReportSheet(
                    reportedId: card.userId,
                    reportedName: card.nickname
                )
            }
            .task {
                // IOS-04: pull fresh entitlements on appear so feed gating reflects
                // server truth, not just the stale on-disk cache.
                await entitlementService.fetchEntitlements()
                await feedService.fetchFeed()
                await feedService.fetchQuota()
            }
        }
    }

    private var cardStack: some View {
        ZStack {
            ForEach(Array(visibleCards.prefix(3).enumerated().reversed()), id: \.element.id) { index, card in
                let isTop = index == 0
                FeedCardView(
                    card: card,
                    dragOffset: isTop ? viewModel.dragOffset : .zero,
                    likeOpacity: isTop ? viewModel.likeOpacity : 0,
                    passOpacity: isTop ? viewModel.passOpacity : 0
                )
                .overlay(alignment: .topTrailing) {
                    if isTop {
                        // REQ-SAFE-OPS-01: report a profile from the feed card (<=2 taps).
                        Menu {
                            Button {
                                reportTarget = card
                            } label: {
                                Label("Report \(card.nickname)", systemImage: "flag")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.white, .black.opacity(0.35))
                                .padding(12)
                        }
                    }
                }
                .scaleEffect(isTop ? 1.0 : 1.0 - CGFloat(index) * 0.05)
                .offset(y: isTop ? 0 : CGFloat(index) * 8)
                .offset(x: isTop ? viewModel.dragOffset.width : 0)
                .rotationEffect(isTop ? .degrees(viewModel.dragRotation) : .zero)
                .gesture(isTop ? dragGesture : nil)
                .animation(.spring(), value: viewModel.dragOffset)
            }
        }
        .padding(.horizontal, 16)
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                viewModel.dragOffset = value.translation
            }
            .onEnded { value in
                if abs(value.translation.width) > 120 {
                    guard let card = feedService.cards.first else { return }
                    let direction = value.translation.width
                    withAnimation(.easeOut(duration: 0.3)) {
                        viewModel.dragOffset = CGSize(
                            width: direction > 0 ? 500 : -500,
                            height: 0
                        )
                    }
                    Task {
                        try? await Task.sleep(for: .milliseconds(200))
                        await viewModel.handleSwipe(card: card, feedService: feedService)
                    }
                } else {
                    withAnimation(.spring()) {
                        viewModel.dragOffset = .zero
                    }
                }
            }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.slash")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No more profiles")
                .font(.title2.bold())
            Text("Check back later for new people")
                .foregroundStyle(.secondary)
            Button("Refresh") {
                feedService.reset()
                Task { await feedService.fetchFeed() }
            }
            .buttonStyle(.borderedProminent)
            .tint(.pink)
        }
    }

    // IOS-04: premium-gated surfaces (likes-you / incognito / travel) behind their flags.
    private var premiumBar: some View {
        HStack(spacing: 10) {
            if entitlementService.canSeeWhoLikesYou {
                premiumChip(title: "Likes You", systemImage: "heart.text.square.fill", tint: .pink)
            }
            if entitlementService.canUseIncognito {
                premiumChip(title: "Incognito", systemImage: "eye.slash.fill", tint: .purple)
            }
            if entitlementService.canUseTravel {
                premiumChip(title: "Travel", systemImage: "airplane", tint: .blue)
            }
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func premiumChip(title: String, systemImage: String, tint: Color) -> some View {
        Label(title, systemImage: systemImage)
            .font(.caption.bold())
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }

    private var previewFooter: some View {
        NavigationLink {
            PaywallView()
        } label: {
            Text("Free preview — upgrade to see everyone")
                .font(.caption.bold())
                .foregroundStyle(.pink)
        }
        .padding(.bottom, 8)
    }

    private var previewPaywall: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundStyle(.pink)
            Text("You've seen your free Top 3")
                .font(.title2.bold())
                .multilineTextAlignment(.center)
            Text("Upgrade to unlock the full feed and keep discovering people.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            NavigationLink {
                PaywallView()
            } label: {
                Text("Upgrade")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.pink)
        }
        .padding(32)
    }

    private func performAction(like: Bool) {
        guard let card = feedService.cards.first else { return }
        withAnimation(.easeOut(duration: 0.3)) {
            viewModel.dragOffset = CGSize(width: like ? 500 : -500, height: 0)
        }
        Task {
            try? await Task.sleep(for: .milliseconds(200))
            await viewModel.handleSwipe(card: card, feedService: feedService)
        }
    }
}
