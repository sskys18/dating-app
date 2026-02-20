import SwiftUI

extension View {
    func primaryButton() -> some View {
        self
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(.pink)
            .foregroundStyle(.white)
            .font(.headline)
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
