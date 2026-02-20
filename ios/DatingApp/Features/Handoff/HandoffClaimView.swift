import SwiftUI

struct HandoffClaimView: View {
    let token: String
    @EnvironmentObject var appState: AppState
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            if isLoading {
                ProgressView("Claiming your profile...")
                    .font(.headline)
            } else if let error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.orange)
                    Text("Claim Failed")
                        .font(.headline)
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Continue to App") {
                        appState.resolveRoute()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.pink)
                }
            }
        }
        .task {
            await claimToken()
        }
    }

    private func claimToken() async {
        do {
            struct ClaimRequest: Encodable {
                let token: String
            }
            struct ClaimResponse: Decodable {
                let success: Bool
                let transferred: TransferredData
            }
            struct TransferredData: Decodable {
                let quizResponse: Bool
                let chatSession: Bool
            }
            let _: ClaimResponse = try await APIClient.shared.post(
                path: "/handoff/claim",
                body: ClaimRequest(token: token)
            )
            appState.resolveRoute()
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }
}
