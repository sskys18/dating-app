import Foundation

@MainActor
class WebSocketService: ObservableObject {
    @Published var isConnected = false

    var onNewMessage: ((ChatMessage) -> Void)?
    var onMessageDelivered: ((String, String) -> Void)?  // messageId, status
    var onMessageRead: ((String) -> Void)?  // chatRoomId
    var onTypingStart: ((String, String) -> Void)?  // chatRoomId, userId
    var onTypingStop: ((String, String) -> Void)?  // chatRoomId, userId

    private var webSocketTask: URLSessionWebSocketTask?
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var pingTimer: Timer?

    init() {
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    func connect() async {
        guard webSocketTask == nil else { return }
        guard let token = await KeychainService.shared.getAccessToken() else { return }

        #if DEBUG
        let host = "ws://localhost:4000"
        #else
        let host = "wss://api.yourdomain.com"
        #endif

        let urlString = "\(host)/socket.io/?EIO=4&transport=websocket&token=\(token)"
        guard let url = URL(string: urlString) else { return }

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        // Socket.IO EIO4: send open handshake
        send(raw: "40")

        isConnected = true
        startPing()
        listen()
    }

    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    func sendMessage(chatRoomId: String, content: String, tempId: String) {
        let payload: [String: String] = [
            "chatRoomId": chatRoomId,
            "content": content,
            "tempId": tempId
        ]
        emit(event: "message:send", data: payload)
    }

    func sendDelivered(messageId: String) {
        emit(event: "message:delivered", data: ["messageId": messageId])
    }

    func sendRead(chatRoomId: String, upToMessageId: String) {
        emit(event: "message:read", data: ["chatRoomId": chatRoomId, "upToMessageId": upToMessageId])
    }

    func sendTypingStart(chatRoomId: String) {
        emit(event: "typing:start", data: ["chatRoomId": chatRoomId])
    }

    func sendTypingStop(chatRoomId: String) {
        emit(event: "typing:stop", data: ["chatRoomId": chatRoomId])
    }

    // MARK: - Private

    private func emit(event: String, data: [String: String]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        // Socket.IO protocol: 42["event",{payload}]
        let frame = "42[\"\(event)\",\(jsonString)]"
        send(raw: frame)
    }

    private func send(raw text: String) {
        webSocketTask?.send(.string(text)) { error in
            if let error = error {
                print("[WebSocket] Send error: \(error.localizedDescription)")
            }
        }
    }

    private func startPing() {
        // Socket.IO EIO4 ping interval (default 25s, we use 20s)
        pingTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.send(raw: "2")  // EIO4 ping
            }
        }
    }

    private nonisolated func listen() {
        Task { @MainActor [weak self] in
            guard let self = self, let task = self.webSocketTask else { return }
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    self.handleFrame(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleFrame(text)
                    }
                @unknown default:
                    break
                }
                self.listen()
            } catch {
                self.isConnected = false
                // Attempt reconnect after delay
                try? await Task.sleep(for: .seconds(3))
                await self.connect()
            }
        }
    }

    private func handleFrame(_ text: String) {
        // EIO4 protocol frames
        if text == "3" { return }  // pong
        if text.hasPrefix("0") { return }  // open
        if text.hasPrefix("40") { return }  // connect ack

        // Socket.IO message: 42["event",{...}]
        guard text.hasPrefix("42") else { return }
        let jsonPart = String(text.dropFirst(2))
        guard let data = jsonPart.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let event = array.first as? String,
              array.count > 1 else { return }

        guard let payloadData = try? JSONSerialization.data(withJSONObject: array[1]) else { return }

        switch event {
        case "message:new":
            if let msg = try? decoder.decode(ChatMessage.self, from: payloadData) {
                onNewMessage?(msg)
            }
        case "message:delivered":
            if let info = try? JSONSerialization.jsonObject(with: payloadData) as? [String: String],
               let messageId = info["messageId"],
               let status = info["status"] {
                onMessageDelivered?(messageId, status)
            }
        case "message:read":
            if let info = try? JSONSerialization.jsonObject(with: payloadData) as? [String: String],
               let chatRoomId = info["chatRoomId"] {
                onMessageRead?(chatRoomId)
            }
        case "typing:start":
            if let info = try? JSONSerialization.jsonObject(with: payloadData) as? [String: String],
               let chatRoomId = info["chatRoomId"],
               let userId = info["userId"] {
                onTypingStart?(chatRoomId, userId)
            }
        case "typing:stop":
            if let info = try? JSONSerialization.jsonObject(with: payloadData) as? [String: String],
               let chatRoomId = info["chatRoomId"],
               let userId = info["userId"] {
                onTypingStop?(chatRoomId, userId)
            }
        default:
            break
        }
    }
}
