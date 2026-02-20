import Foundation
import Security

actor KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.datingapp.auth"

    private enum Keys {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
    }

    private init() {}

    // MARK: - Access Token

    func getAccessToken() -> String? {
        read(key: Keys.accessToken)
    }

    func setAccessToken(_ token: String) {
        save(key: Keys.accessToken, value: token)
    }

    func deleteAccessToken() {
        delete(key: Keys.accessToken)
    }

    // MARK: - Refresh Token

    func getRefreshToken() -> String? {
        read(key: Keys.refreshToken)
    }

    func setRefreshToken(_ token: String) {
        save(key: Keys.refreshToken, value: token)
    }

    func deleteRefreshToken() {
        delete(key: Keys.refreshToken)
    }

    // MARK: - Clear All

    func clearAll() {
        deleteAccessToken()
        deleteRefreshToken()
    }

    // MARK: - Private Helpers

    private func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
        ]

        SecItemDelete(query as CFDictionary)
    }
}
