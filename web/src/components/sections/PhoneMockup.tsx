import { chatMessages } from '../../data/chatMessages';

export default function PhoneMockup() {
  return (
    <div
      className="relative mx-auto w-[280px] sm:w-[300px]"
      style={{ animation: 'float 4s ease-in-out infinite' }}
    >
      {/* Phone frame */}
      <div className="overflow-hidden rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl">
        {/* Notch */}
        <div className="relative flex h-7 items-center justify-center bg-gray-800">
          <div className="h-3 w-20 rounded-full bg-gray-900" />
        </div>

        {/* Screen */}
        <div className="bg-[#efeae2]">
          {/* WhatsApp header */}
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-whatsapp text-xs font-bold text-white">
              WE
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Whatseg Bot</p>
              <p className="text-[10px] text-green-200">en línea</p>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex flex-col gap-2 px-3 py-4" style={{ minHeight: '320px' }}>
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
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
                  <p className="mt-0.5 text-right text-[10px] text-gray-500">
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2">
            <div className="flex-1 rounded-full bg-white px-4 py-2 text-xs text-gray-400">
              Escribe un mensaje...
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-whatsapp">
              <svg
                className="h-4 w-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div
        className="absolute -inset-4 -z-10 rounded-[3rem] bg-whatsapp/20 blur-2xl"
        style={{ animation: 'pulse-ring 3s ease-in-out infinite' }}
      />
    </div>
  );
}
