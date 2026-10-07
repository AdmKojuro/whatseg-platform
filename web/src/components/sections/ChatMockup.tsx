import { chatMessages } from '../../data/chatMessages';

export default function ChatMockup() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      {/* WhatsApp header */}
      <div className="flex items-center gap-3 bg-[#075e54] px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-whatsapp text-sm font-bold text-white">
          WE
        </div>
        <div>
          <p className="font-semibold text-white">Whatseg Bot</p>
          <p className="text-xs text-green-200">en línea</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col gap-3 bg-[#efeae2] px-4 py-5">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                msg.from === 'user'
                  ? 'rounded-tr-none bg-[#dcf8c6] text-gray-800'
                  : 'rounded-tl-none bg-white text-gray-800'
              }`}
            >
              <p className="whitespace-pre-line">
                {msg.text.split(/(\*[^*]+\*)/).map((part, j) =>
                  part.startsWith('*') && part.endsWith('*') ? (
                    <strong key={j}>{part.slice(1, -1)}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
              <p className="mt-1 text-right text-[10px] text-gray-500">
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 bg-[#f0f0f0] px-4 py-3">
        <div className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm text-gray-400">
          Escribe un mensaje...
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-whatsapp">
          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
