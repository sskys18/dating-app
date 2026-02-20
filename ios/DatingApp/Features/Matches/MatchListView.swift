import SwiftUI

struct MatchListView: View {
    @EnvironmentObject var matchService: MatchService

    var body: some View {
        NavigationStack {
            List {
                if !newMatches.isEmpty {
                    Section("New Matches") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                ForEach(newMatches) { match in
                                    NavigationLink {
                                        ChatView(
                                            chatRoomId: match.chatRoomId,
                                            otherUser: match.otherUser
                                        )
                                    } label: {
                                        VStack(spacing: 6) {
                                            AsyncImage(url: URL(string: match.otherUser.photoUrl)) { phase in
                                                switch phase {
                                                case .success(let image):
                                                    image.resizable().aspectRatio(contentMode: .fill)
                                                default:
                                                    Image(systemName: "person.circle.fill")
                                                        .resizable()
                                                        .foregroundStyle(.gray)
                                                }
                                            }
                                            .frame(width: 64, height: 64)
                                            .clipShape(Circle())
                                            .overlay(Circle().stroke(.pink, lineWidth: 2))

                                            Text(match.otherUser.nickname)
                                                .font(.caption)
                                                .lineLimit(1)
                                                .foregroundStyle(.primary)
                                        }
                                        .frame(width: 72)
                                    }
                                }
                            }
                            .padding(.vertical, 8)
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                    }
                }

                if !messagesMatches.isEmpty {
                    Section("Messages") {
                        ForEach(messagesMatches) { match in
                            NavigationLink {
                                ChatView(
                                    chatRoomId: match.chatRoomId,
                                    otherUser: match.otherUser
                                )
                            } label: {
                                MatchRowView(match: match)
                            }
                        }
                    }
                }

                if matchService.matches.isEmpty && !matchService.isLoading {
                    ContentUnavailableView(
                        "No matches yet",
                        systemImage: "heart.circle",
                        description: Text("Keep swiping to find your match!")
                    )
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Matches")
            .refreshable {
                await matchService.fetchMatches()
            }
            .task {
                await matchService.fetchMatches()
            }
        }
    }

    private var newMatches: [MatchListItem] {
        matchService.matches.filter { $0.lastMessage == nil }
    }

    private var messagesMatches: [MatchListItem] {
        matchService.matches.filter { $0.lastMessage != nil }
    }
}
