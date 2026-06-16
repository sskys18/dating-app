import SwiftUI

/// REQ-SAFE-OPS-01: report a user within <=2 taps from a chat or a profile/feed card.
/// Reason picker + optional note, POSTed to /reports. When opened from a chat,
/// `chatRoomId` is passed so the backend snapshots the conversation (REQ-RTC-05).
enum ReportReason: String, CaseIterable, Identifiable {
    case spam
    case harassment
    case inappropriateContent = "inappropriate_content"
    case fakeProfile = "fake_profile"
    case underage
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .spam: return "Spam"
        case .harassment: return "Harassment"
        case .inappropriateContent: return "Inappropriate content"
        case .fakeProfile: return "Fake profile"
        case .underage: return "Underage user"
        case .other: return "Other"
        }
    }
}

struct ReportSheet: View {
    /// The user being reported.
    let reportedId: String
    let reportedName: String
    /// Non-nil when launched from a chat so the conversation is snapshotted server-side.
    var chatRoomId: String?
    /// Invoked after a successful submission (e.g. to dismiss/leave the chat).
    var onReported: (() -> Void)?

    @StateObject private var viewModel = ReportViewModel()
    @Environment(\.dismiss) private var dismiss

    // The backend caps `description` at 1000 chars (CreateReportDto.MaxLength).
    private let noteLimit = 1000

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(ReportReason.allCases) { reason in
                        Button {
                            viewModel.selectedReason = reason
                        } label: {
                            HStack {
                                Text(reason.label)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if viewModel.selectedReason == reason {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.pink)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Why are you reporting \(reportedName)?")
                }

                Section {
                    TextField(
                        "Add details (optional)",
                        text: $viewModel.note,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                    .onChange(of: viewModel.note) {
                        if viewModel.note.count > noteLimit {
                            viewModel.note = String(viewModel.note.prefix(noteLimit))
                        }
                    }
                } header: {
                    Text("Details")
                } footer: {
                    Text("Your report is confidential. We capture a snapshot for our safety team.")
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if viewModel.isSubmitting {
                        ProgressView()
                    } else {
                        Button("Submit") {
                            Task {
                                let success = await viewModel.submit(
                                    reportedId: reportedId,
                                    chatRoomId: chatRoomId
                                )
                                if success {
                                    onReported?()
                                    dismiss()
                                }
                            }
                        }
                        .disabled(viewModel.selectedReason == nil)
                    }
                }
            }
        }
    }
}

@MainActor
final class ReportViewModel: ObservableObject {
    @Published var selectedReason: ReportReason?
    @Published var note: String = ""
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    func submit(reportedId: String, chatRoomId: String?) async -> Bool {
        guard let reason = selectedReason else { return false }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let success = await ReportService.shared.submitReport(
            reportedId: reportedId,
            reason: reason.rawValue,
            description: trimmedNote.isEmpty ? nil : trimmedNote,
            chatRoomId: chatRoomId
        )
        if !success {
            errorMessage = "Couldn't send your report. Please try again."
        }
        return success
    }
}
