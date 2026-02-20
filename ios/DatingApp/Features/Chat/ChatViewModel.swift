import SwiftUI

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText = ""
    @Published var isOtherTyping = false
    @Published var starters: [String] = []
    @Published var isLoading = false

    let chatRoomId: String
    private var nextCursor: String?
    private var hasMore = true

    init(chatRoomId: String) {
        self.chatRoomId = chatRoomId
    }

    func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }

        // Load chat room details for starters
        do {
            let detail: ChatRoomDetail = try await APIClient.shared.get(
                path: "/messaging/\(chatRoomId)"
            )
            starters = detail.starters
        } catch {
            // Starters are optional, continue without them
        }

        await loadMessages()
    }

    func loadMessages() async {
        guard hasMore else { return }
        do {
            var path = "/messaging/\(chatRoomId)/messages?limit=30"
            if let cursor = nextCursor { path += "&cursor=\(cursor)" }
            let response: PaginatedResponse<ChatMessage> = try await APIClient.shared.get(path: path)
            // Prepend older messages (API returns newest first)
            let newMessages = response.items.reversed()
            messages.insert(contentsOf: newMessages, at: 0)
            nextCursor = response.nextCursor
            hasMore = response.hasMore
        } catch {
            // Keep existing messages on failure
        }
    }

    func sendMessage(webSocketService: WebSocketService) {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let tempId = UUID().uuidString

        // Optimistic local message
        let localMessage = ChatMessage(
            id: tempId,
            chatRoomId: chatRoomId,
            senderId: "me",
            content: text,
            status: .sent,
            createdAt: Date(),
            tempId: tempId
        )
        messages.append(localMessage)
        inputText = ""

        webSocketService.sendMessage(chatRoomId: chatRoomId, content: text, tempId: tempId)
    }

    func sendStarter(text: String, webSocketService: WebSocketService) {
        inputText = text
        sendMessage(webSocketService: webSocketService)
    }

    func handleIncomingMessage(_ message: ChatMessage) {
        // Dedup: replace optimistic message by tempId
        if let tempId = message.tempId,
           let index = messages.firstIndex(where: { $0.tempId == tempId }) {
            messages[index] = message
        } else if !messages.contains(where: { $0.id == message.id }) {
            messages.append(message)
        }
    }
}
