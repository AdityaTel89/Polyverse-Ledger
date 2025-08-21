import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Layers3, FileText } from 'lucide-react';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 overflow-auto">
      <section className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:py-20">
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Cross-Chain Credit & Invoicing Oracle
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              The Polyverse Ledger
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-600 sm:text-lg">
              Aggregate identity and activity across blockchains with UBIDs, produce a unified Web3 credit score, and
              generate immutable invoices—delivered as a scalable cloud service.
            </p>

            {/* Primary Actions */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/user-registry')}
                className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                aria-label="Get Started - go to User Registry"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>

            {/* Small usage hint */}
            <p className="mt-3 text-xs text-gray-500">
              Clicking “Get Started” opens the User Registry to begin onboarding wallets and identities.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {/* UBID */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center">
                <Layers3 className="h-5 w-5 text-indigo-600" />
                <h3 className="ml-2 text-base font-semibold text-gray-900">Universal Blockchain Identifier (UBID)</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Assign unique identifiers to users, networks, and blocks—linking multi-chain activity to a single profile
                for consistent tracking.
              </p>
            </div>

            {/* Credit Scoring */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h3 className="ml-2 text-base font-semibold text-gray-900">Polyverse Credit Scoring</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Analyze on-chain assets, volumes, and dApp interactions to compute a holistic, cross-chain credit score
                accessible via API.
              </p>
            </div>

            {/* Invoicing */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="ml-2 text-base font-semibold text-gray-900">Immutable Blockchain Invoicing</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Auto-generate and store invoices on-chain for transparent audits, fraud reduction, and simplified
                reconciliation.
              </p>
            </div>
          </div>

          {/* Details / Narrative */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Why Polyverse Ledger?</h2>
              <p className="mt-3 text-sm leading-6 text-gray-700">
                The decentralized ecosystem spans many siloed chains. Polyverse bridges them with UBIDs, unifying a
                user’s Ethereum, Bitcoin, and other network activity into a single profile. This enables accurate credit
                assessment and standardized invoicing across chains—delivered through a robust, cloud-based API surface
                with tiered plans for lenders and businesses.
              </p>
              <p className="mt-3 text-sm leading-6 text-gray-700">
                Start by registering identities and wallets in the User Registry. From there, connect blockchains, ingest
                activity, compute credit scores, and generate invoices as needed.
              </p>

              <div className="mt-6">
                <button
                  onClick={() => navigate('/user-registry')}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Welcome;
