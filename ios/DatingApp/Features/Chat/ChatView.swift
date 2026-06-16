import SwiftUI

struct ChatView: View {
    let chatRoomId: String
    let otherUser: MatchUser

    @StateObject private var viewModel: ChatViewModel
    @EnvironmentObject var webSocketService: WebSocketService
    @EnvironmentObject var blockService: BlockService
    @EnvironmentObject var matchService: MatchService
    @EnvironmentObject var appState: AppState

    @State private var showBlockConfirm = false
    @State private var showReportSheet = false
    @Environment(\.dismiss) private var dismiss

    init(chatRoomId: String, otherUser: MatchUser) {
        self.chatRoomId = chatRoomId
        self.otherUser = otherUser
        _viewModel = StateObject(wrappedValue: ChatViewModel(chatRoomId: chatRoomId))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if viewModel.messages.isEmpty && !viewModel.isLoading {
                            StarterSuggestionsView(
                                starters: viewModel.starters,
                                onSelect: { text in
                                    viewModel.sendStarter(text: text, webSocketService: webSocketService)
                                }
                            )
                            .padding(.top, 32)
                        }

                        ForEach(viewModel.messages) { message in
                            MessageBubbleView(
                                message: message,
                                currentUserId: appState.userProfile?.id ?? "me"
                            )
                            .id(message.id)
                        }

                        if viewModel.isOtherTyping {
                            HStack {
                                Text("\(otherUser.nickname) is typing...")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .italic()
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .id("typing")
                        }
                    }
                    .padding(.vertical, 8)
                }
                .onChange(of: viewModel.messages.count) {
                    withAnimation {
                        proxy.scrollTo(viewModel.messages.last?.id, anchor: .bottom)
                    }
                }
            }

            ChatInputBar(
                text: $viewModel.inputText,
                onSend: {
                    viewModel.sendMessage(webSocketService: webSocketService)
                    matchService.updateLastMessage(
                        chatRoomId: chatRoomId,
                        content: viewModel.inputText,
                        senderId: appState.userProfile?.id ?? "me"
                    )
                },
                onTypingChanged: { isTyping in
                    if isTyping {
                        webSocketService.sendTypingStart(chatRoomId: chatRoomId)
                    } else {
                        webSocketService.sendTypingStop(chatRoomId: chatRoomId)
                    }
                }
            )
        }
        .navigationTitle(otherUser.nickname)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showReportSheet = true
                    } label: {
                        Label("Report User", systemImage: "flag")
                    }
                    Button(role: .destructive) {
                        showBlockConfirm = true
                    } label: {
                        Label("Block User", systemImage: "hand.raised")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                }
            }
        }
        .alert("Block \(otherUser.nickname)?", isPresented: $showBlockConfirm) {
            Button("Block", role: .destructive) {
                Task {
                    let success = await blockService.blockUser(blockedId: otherUser.id)
                    if success { dismiss() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("They won't be able to contact you, and you won't see them again.")
        }
        .sheet(isPresented: $showReportSheet) {
            ReportSheet(
                reportedId: otherUser.id,
                reportedName: otherUser.nickname,
                chatRoomId: chatRoomId
            )
        }
        .task {
            await viewModel.loadInitialData()
            setupWebSocketHandlers()
        }
        .onDisappear {
            webSocketService.sendTypingStop(chatRoomId: chatRoomId)
        }
    }

    private func setupWebSocketHandlers() {
        webSocketService.onNewMessage = { message in
            if message.chatRoomId == chatRoomId {
                viewModel.handleIncomingMessage(message)
                webSocketService.sendDelivered(messageId: message.id)
            }
        }

        webSocketService.onTypingStart = { roomId, userId in
            if roomId == chatRoomId && userId == otherUser.id {
                viewModel.isOtherTyping = true
            }
        }

        webSocketService.onTypingStop = { roomId, userId in
            if roomId == chatRoomId && userId == otherUser.id {
                viewModel.isOtherTyping = false
            }
        }
    }
}
