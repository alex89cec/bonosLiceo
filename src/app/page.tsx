"use client";

import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero section with navy background */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-navy-700 px-6 pb-12 pt-16">
        {/* Decorative gold accent line */}
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gold-500" />

        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/logo.png"
            alt="CEC Liceo Militar"
            width={280}
            height={73}
            priority
            className="drop-shadow-lg"
          />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Bonos Contribucion
        </h1>
        <p className="mb-10 text-center text-base text-navy-200">
          Plataforma oficial de bonos contribucion
        </p>

        {/* Three access cards */}
        <div className="w-full max-w-sm space-y-3">
          {/* Buyer access */}
          <Link
            href="/mis-numeros"
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-gold-400/30 bg-white/10 p-5 backdrop-blur-sm transition-all hover:border-gold-400/60 hover:bg-white/15 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gold-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-navy-900"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-white">Mis Bonos</p>
              <p className="text-sm text-navy-200">
                Consulta tus bonos comprados
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ml-auto h-5 w-5 text-navy-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>

          {/* Seller access */}
          <Link
            href="/login"
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-navy-500/50 bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-navy-400/60 hover:bg-white/10 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-navy-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-gold-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                Portal Vendedores
              </p>
              <p className="text-sm text-navy-300">
                Ingresa como vendedor
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ml-auto h-5 w-5 text-navy-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>

          {/* Admin access */}
          <Link
            href="/login?redirect=/admin"
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-navy-500/50 bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-navy-400/60 hover:bg-white/10 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-navy-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-gold-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                Portal Admin
              </p>
              <p className="text-sm text-navy-300">
                Ingresa como administrador
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ml-auto h-5 w-5 text-navy-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-navy-800 px-6 py-4 text-center">
        <p className="text-xs text-navy-400">
          CEC Liceo Militar General San Martin
        </p>
      </div>
    </main>
  );
}
