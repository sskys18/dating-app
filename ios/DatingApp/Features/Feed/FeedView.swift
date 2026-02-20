import SwiftUI

struct FeedView: View {
    @EnvironmentObject var feedService: FeedService
    @EnvironmentObject var entitlementService: EntitlementService
    @StateObject private var viewModel = FeedViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                if feedService.cards.isEmpty && !feedService.isLoading {
                    emptyState
                } else {
                    VStack {
                        Spacer()
                        cardStack
                        Spacer()
                        FeedActionBar(
                            likeQuota: feedService.likeQuota,
                            onPass: { performAction(like: false) },
                            onLike: { performAction(like: true) }
                        )
                        .padding(.bottom, 8)
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
            .task {
                await feedService.fetchFeed()
                await feedService.fetchQuota()
            }
        }
    }

    private var cardStack: some View {
        ZStack {
            ForEach(Array(feedService.cards.prefix(3).enumerated().reversed()), id: \.element.id) { index, card in
                let isTop = index == 0
                FeedCardView(
                    card: card,
                    dragOffset: isTop ? viewModel.dragOffset : .zero,
                    likeOpacity: isTop ? viewModel.likeOpacity : 0,
                    passOpacity: isTop ? viewModel.passOpacity : 0
                )
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
