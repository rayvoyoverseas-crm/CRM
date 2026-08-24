import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  Link,
} from "react-router-dom";

import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

import {
  IndianRupee,
  Search,
  ExternalLink,
} from "lucide-react";


const SYMBOLS = {
  INR: "₹",
  GBP: "£",
  EUR: "€",
  USD: "$",
};


function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function getRate(section) {
  if (
    !section ||
    section.currency === "INR"
  ) {
    return 1;
  }

  return numberValue(
    section.exchange_rate
  );
}


function formatMoney(
  amount,
  currency = "INR"
) {
  const number =
    numberValue(amount);

  return `${
    SYMBOLS[currency] || ""
  }${number.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}


function calculatePercentage(
  section,
  amountField
) {
  if (!section?.enabled) {
    return {
      original: 0,
      inr: 0,
      currency:
        section?.currency ||
        "INR",
    };
  }

  const amount =
    numberValue(
      section[amountField]
    );

  const percentage =
    numberValue(
      section.commission_percent
    );

  const commission =
    amount *
    (percentage / 100);

  const rate =
    getRate(section);

  return {
    original:
      commission,

    inr:
      commission * rate,

    currency:
      section.currency ||
      "INR",
  };
}


function calculateProfit(
  section,
  payableField
) {
  if (!section?.enabled) {
    return {
      original: 0,
      inr: 0,
      currency:
        section?.currency ||
        "INR",
    };
  }

  const collected =
    numberValue(
      section.total_taken
    );

  const payable =
    numberValue(
      section[payableField]
    );

  const profit =
    Math.max(
      0,
      collected - payable
    );

  const rate =
    getRate(section);

  return {
    original: profit,

    inr:
      profit * rate,

    currency:
      section.currency ||
      "INR",
  };
}


function buildLedgerRow(record) {
  const revenue =
    record.revenue || {};

  const university =
    revenue.university || {};

  const universityRate =
    getRate(university);

  const grossTuition =
    university.enabled
      ? numberValue(
          university.tuition_fee
        )
      : 0;

  const scholarship =
    university.enabled &&
    university.scholarship ===
      "yes"
      ? numberValue(
          university.scholarship_amount
        )
      : 0;

  const netTuition =
    Math.max(
      0,
      grossTuition -
        scholarship
    );

  const universityCommission =
    university.enabled
      ? netTuition *
        (
          numberValue(
            university.commission_percent
          ) / 100
        )
      : 0;

  const universityCommissionInr =
    universityCommission *
    universityRate;


  const loan =
    calculatePercentage(
      revenue.education_loan,
      "loan_amount"
    );


  const accommodation =
    calculatePercentage(
      revenue.accommodation,
      "booking_amount"
    );


  const ielts =
    calculateProfit(
      revenue.ielts,
      "actual_cost"
    );


  const tuitionProfit =
    calculateProfit(
      revenue.tuition_fee_profit,
      "amount_payable"
    );


  const visaProfit =
    calculateProfit(
      revenue.visa_fee_profit,
      "amount_payable"
    );


  const otherProfitInr =
    ielts.inr +
    tuitionProfit.inr +
    visaProfit.inr;


  const service =
    revenue.service_package || {};

  const serviceRate =
    getRate(service);

  const serviceAmount =
    service.enabled
      ? numberValue(
          service.package_fee
        )
      : 0;

  const serviceInr =
    serviceAmount *
    serviceRate;


  return {
    ...record,

    universityName:
      university.university_name ||
      "—",

    universityCurrency:
      university.currency ||
      "INR",

    universityCommission,

    universityCommissionInr,

    loan,

    accommodation,

    otherProfitInr,

    serviceAmount,

    serviceInr,

    serviceCurrency:
      service.currency ||
      "INR",
  };
}


function DualMoney({
  original,
  inr,
  currency,
}) {
  if (
    !numberValue(original) &&
    !numberValue(inr)
  ) {
    return (
      <span className="text-stone-300">
        —
      </span>
    );
  }

  return (
    <div>
      <div className="font-semibold text-stone-800 whitespace-nowrap">
        {formatMoney(
          original,
          currency
        )}
      </div>

      {currency !== "INR" && (
        <div className="text-[11px] text-stone-500 mt-0.5 whitespace-nowrap">
          {formatMoney(
            inr,
            "INR"
          )}
        </div>
      )}
    </div>
  );
}


export default function Revenue() {
  const { user } =
    useAuth();

  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");


  useEffect(() => {
    if (
      user?.role !== "admin"
    ) {
      return;
    }

    const loadRevenue =
      async () => {
        try {
          setLoading(true);

          const { data } =
            await api.get(
              "/revenue"
            );

          setRecords(
            Array.isArray(data)
              ? data
              : []
          );
        } catch (error) {
          console.error(
            "Unable to load revenue ledger",
            error
          );

          setRecords([]);
        } finally {
          setLoading(false);
        }
      };

    loadRevenue();
  }, [user?.role]);


  const ledger =
    useMemo(
      () =>
        records.map(
          buildLedgerRow
        ),
      [records]
    );


  const filteredLedger =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return ledger;
      }

      return ledger.filter(
        (row) =>
          String(
            row.student_name ||
              ""
          )
            .toLowerCase()
            .includes(query) ||

          String(
            row.universityName ||
              ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      ledger,
      search,
    ]);


  const totals =
    useMemo(() => {
      return ledger.reduce(
        (total, row) => {
          total.expected +=
            numberValue(
              row.expected_inr
            );

          total.received +=
            numberValue(
              row.received_inr
            );

          total.balance +=
            numberValue(
              row.balance_inr
            );

          return total;
        },
        {
          expected: 0,
          received: 0,
          balance: 0,
        }
      );
    }, [ledger]);


  if (
    user &&
    user.role !== "admin"
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  return (
    <Layout
      title="Revenue"
      subtitle="Finance summary across all students."
    >
      <div className="space-y-5">

        {/* Overall Revenue Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <SummaryCard
            label="Total Expected"
            value={
              totals.expected
            }
          />

          <SummaryCard
            label="Total Received"
            value={
              totals.received
            }
            type="received"
          />

          <SummaryCard
            label="Total Outstanding"
            value={
              totals.balance
            }
            type="outstanding"
          />

        </div>


        {/* Ledger */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

          <div className="p-5 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-[#C05B43]" />

                <h2 className="font-display font-semibold text-lg">
                  Student Revenue Ledger
                </h2>
              </div>

              <p className="text-xs text-stone-400 mt-1">
                Revenue saved from individual student profiles.
              </p>
            </div>


            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search student or university"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-200 text-sm"
              />
            </div>

          </div>


          {loading ? (
            <div className="p-10 text-center text-sm text-stone-400">
              Loading revenue...
            </div>
          ) : filteredLedger.length ===
            0 ? (
            <div className="p-10 text-center text-sm text-stone-400">
              No revenue records found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1500px] text-left">

                <thead className="bg-stone-50 border-b border-stone-200">

                  <tr className="text-[10px] uppercase tracking-widest text-stone-400">

                    <th className="px-4 py-3 font-semibold">
                      Student
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      University
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      University Commission
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Education Loan
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Accommodation
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Other Profit
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Service Package
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Total Expected
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Received
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Outstanding
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-stone-100">

                  {filteredLedger.map(
                    (row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-stone-50/70"
                      >

                        {/* Student */}
                        <td className="px-4 py-4">

                          <Link
                            to={`/lead/${row.lead_id}`}
                            className="font-semibold text-sm text-stone-800 hover:text-[#C05B43] inline-flex items-center gap-1"
                          >
                            {row.student_name}

                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          {row.student_email && (
                            <div className="text-[11px] text-stone-400 mt-1">
                              {row.student_email}
                            </div>
                          )}

                        </td>


                        {/* University */}
                        <td className="px-4 py-4 text-sm text-stone-700">
                          {row.universityName}
                        </td>


                        {/* University Commission */}
                        <td className="px-4 py-4">
                          <DualMoney
                            original={
                              row.universityCommission
                            }
                            inr={
                              row.universityCommissionInr
                            }
                            currency={
                              row.universityCurrency
                            }
                          />
                        </td>


                        {/* Loan */}
                        <td className="px-4 py-4">
                          <DualMoney
                            original={
                              row.loan.original
                            }
                            inr={
                              row.loan.inr
                            }
                            currency={
                              row.loan.currency
                            }
                          />
                        </td>


                        {/* Accommodation */}
                        <td className="px-4 py-4">
                          <DualMoney
                            original={
                              row.accommodation.original
                            }
                            inr={
                              row.accommodation.inr
                            }
                            currency={
                              row.accommodation.currency
                            }
                          />
                        </td>


                        {/* Other Profit */}
                        <td className="px-4 py-4">
                          <div className="font-semibold text-stone-800 whitespace-nowrap">
                            {row.otherProfitInr
                              ? formatMoney(
                                  row.otherProfitInr,
                                  "INR"
                                )
                              : "—"}
                          </div>
                        </td>


                        {/* Service Package */}
                        <td className="px-4 py-4">
                          <DualMoney
                            original={
                              row.serviceAmount
                            }
                            inr={
                              row.serviceInr
                            }
                            currency={
                              row.serviceCurrency
                            }
                          />
                        </td>


                        {/* Expected */}
                        <td className="px-4 py-4 font-semibold text-stone-900 whitespace-nowrap">
                          {formatMoney(
                            row.expected_inr,
                            "INR"
                          )}
                        </td>


                        {/* Received */}
                        <td className="px-4 py-4 font-semibold text-emerald-700 whitespace-nowrap">
                          {formatMoney(
                            row.received_inr,
                            "INR"
                          )}
                        </td>


                        {/* Outstanding */}
                        <td className="px-4 py-4 font-semibold text-[#C05B43] whitespace-nowrap">
                          {formatMoney(
                            row.balance_inr,
                            "INR"
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </Layout>
  );
}


function SummaryCard({
  label,
  value,
  type,
}) {
  let border =
    "border-stone-200";

  let text =
    "text-stone-900";

  if (
    type === "received"
  ) {
    border =
      "border-emerald-200";

    text =
      "text-emerald-700";
  }

  if (
    type === "outstanding"
  ) {
    border =
      "border-amber-200";

    text =
      "text-amber-700";
  }

  return (
    <div
      className={`bg-white border ${border} rounded-2xl p-5`}
    >
      <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-display font-bold ${text}`}
      >
        {formatMoney(
          value,
          "INR"
        )}
      </div>
    </div>
  );
}
