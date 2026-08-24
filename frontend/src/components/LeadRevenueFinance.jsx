import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  IndianRupee,
  Save,
} from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["INR", "GBP", "EUR", "USD"];

const CURRENCY_SYMBOLS = {
  INR: "₹",
  GBP: "£",
  EUR: "€",
  USD: "$",
};

function getInitialRevenue() {
  return {
    university: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      university_name: "",
      tuition_fee: "",
      scholarship: "no",
      scholarship_amount: "",
      commission_percent: "",
    },

    education_loan: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      organisation: "",
      loan_amount: "",
      commission_percent: "",
    },

    accommodation: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      organisation: "",
      booking_amount: "",
      commission_percent: "",
    },

    ielts: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      total_taken: "",
      actual_cost: "",
    },

    tuition_fee_profit: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      amount_payable: "",
      total_taken: "",
    },

    visa_fee_profit: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      amount_payable: "",
      total_taken: "",
    },

    service_package: {
      enabled: false,
      currency: "INR",
      exchange_rate: 1,
      received_amount: "",
      package_type: "",
      package_name: "",
      package_fee: "",
    },
  };
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getRate(section) {
  if (section?.currency === "INR") {
    return 1;
  }

  return numberValue(
    section?.exchange_rate
  );
}

function formatMoney(
  amount,
  currency = "INR"
) {
  const value =
    numberValue(amount);

  return `${
    CURRENCY_SYMBOLS[currency] || ""
  }${value.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function SectionToggle({
  title,
  enabled,
  onChange,
  children,
}) {
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-4 bg-stone-50">
        <div>
          <h4 className="font-semibold text-sm text-stone-900">
            {title}
          </h4>

          <p className="text-xs text-stone-400 mt-1">
            Include this revenue source for this student.
          </p>
        </div>

        <div className="flex bg-stone-200/60 rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() =>
              onChange(true)
            }
            className={`px-4 py-2 text-xs rounded-lg transition ${
              enabled
                ? "bg-[#1B365D] text-white shadow-sm"
                : "text-stone-500"
            }`}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() =>
              onChange(false)
            }
            className={`px-4 py-2 text-xs rounded-lg transition ${
              !enabled
                ? "bg-white text-stone-800 shadow-sm"
                : "text-stone-500"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {enabled && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function CurrencyFields({
  data,
  update,
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">
          Currency
        </label>

        <select
          value={
            data.currency
          }
          onChange={(e) => {
            const currency =
              e.target.value;

            update(
              "currency",
              currency
            );

            if (
              currency === "INR"
            ) {
              update(
                "exchange_rate",
                1
              );
            }
          }}
          className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm"
        >
          {CURRENCIES.map(
            (currency) => (
              <option
                key={currency}
                value={currency}
              >
                {currency} (
                {
                  CURRENCY_SYMBOLS[
                    currency
                  ]
                }
                )
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1.5">
          Exchange Rate to INR
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={
            data.exchange_rate
          }
          disabled={
            data.currency === "INR"
          }
          onChange={(e) =>
            update(
              "exchange_rate",
              e.target.value
            )
          }
          className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm disabled:bg-stone-100"
          placeholder="Example: 130.51"
        />

        {data.currency !==
          "INR" && (
          <div className="text-[11px] text-stone-400 mt-1">
            1 {data.currency} =
            ₹
            {numberValue(
              data.exchange_rate
            ).toLocaleString(
              "en-IN"
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ReceivedField({
  data,
  update,
}) {
  const received =
    numberValue(
      data.received_amount
    );

  const rate =
    getRate(data);

  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1.5">
        Amount Received
      </label>

      <input
        type="number"
        min="0"
        step="0.01"
        value={
          data.received_amount
        }
        onChange={(e) =>
          update(
            "received_amount",
            e.target.value
          )
        }
        className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
        placeholder={`Received in ${data.currency}`}
      />

      <div className="text-[11px] text-stone-400 mt-1">
        INR equivalent:{" "}
        {formatMoney(
          received * rate,
          "INR"
        )}
      </div>
    </div>
  );
}

function AmountConversion({
  label,
  amount,
  currency,
  rate,
}) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
        {label}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div>
          <div className="text-[11px] text-stone-400">
            {currency}
          </div>

          <div className="font-semibold text-stone-900">
            {formatMoney(
              amount,
              currency
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-stone-400">
            INR
          </div>

          <div className="font-semibold text-stone-900">
            {formatMoney(
              amount * rate,
              "INR"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueResult({
  label,
  amount,
  received,
  currency,
  rate,
}) {
  const outstanding =
    Math.max(
      0,
      amount - received
    );

  return (
    <div className="mt-4 border border-stone-200 rounded-xl p-4 bg-stone-50">
      <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
        {label}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
        <div>
          <div className="text-xs text-stone-500">
            Expected
          </div>

          <div className="font-semibold mt-1">
            {formatMoney(
              amount,
              currency
            )}
          </div>

          <div className="text-xs text-stone-500 mt-1">
            {formatMoney(
              amount * rate,
              "INR"
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            Received
          </div>

          <div className="font-semibold text-emerald-700 mt-1">
            {formatMoney(
              received,
              currency
            )}
          </div>

          <div className="text-xs text-emerald-600 mt-1">
            {formatMoney(
              received * rate,
              "INR"
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            Outstanding
          </div>

          <div className="font-semibold text-[#C05B43] mt-1">
            {formatMoney(
              outstanding,
              currency
            )}
          </div>

          <div className="text-xs text-[#C05B43] mt-1">
            {formatMoney(
              outstanding * rate,
              "INR"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeadRevenueFinance({
  lead,
  leadId,
}) {
  const { user } = useAuth();

  const [
    revenue,
    setRevenue,
  ] = useState(
    getInitialRevenue
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  useEffect(() => {
    if (
      user?.role !== "admin" ||
      !leadId
    ) {
      return;
    }

    const loadRevenue =
      async () => {
        try {
          setLoading(true);

          const { data } =
            await api.get(
              `/revenue/${leadId}`
            );

          if (
            data?.exists &&
            data?.revenue
          ) {
            setRevenue({
              ...data.revenue,
          
              education_loan: {
                ...data.revenue.education_loan,
                currency: "INR",
                exchange_rate: 1,
              },
            });
          
            return;
          }

          const fresh =
            getInitialRevenue();

          const application =
            Array.isArray(
              lead?.application_records
            )
              ? lead.application_records.find(
                  (item) =>
                    item.university
                )
              : null;

          if (
            application?.university
          ) {
            fresh.university.university_name =
              application.university;
          } else if (
            lead?.offer_university
          ) {
            fresh.university.university_name =
              lead.offer_university;
          }

          setRevenue(fresh);
        } catch (error) {
          console.error(
            "Unable to load lead revenue",
            error
          );

          setRevenue(
            getInitialRevenue()
          );
        } finally {
          setLoading(false);
        }
      };

    loadRevenue();
  }, [
    leadId,
    user?.role,
    lead,
  ]);

  const updateSection = (
    section,
    field,
    value
  ) => {
    setRevenue(
      (previous) => ({
        ...previous,

        [section]: {
          ...previous[
            section
          ],

          [field]:
            value,
        },
      })
    );
  };

  const toggleSection = (
    section,
    enabled
  ) => {
    setRevenue(
      (previous) => ({
        ...previous,

        [section]: {
          ...previous[
            section
          ],

          enabled,
        },
      })
    );
  };

  const calculations =
    useMemo(() => {
      const university =
        revenue.university;

      const universityRate =
        getRate(
          university
        );

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
        netTuition *
        (
          numberValue(
            university.commission_percent
          ) / 100
        );

      const universityResult = {
        amount:
          universityCommission,

        received:
          numberValue(
            university.received_amount
          ),

        rate:
          universityRate,
      };

      const percentageCalculation = (
        section,
        amountField
      ) => {
        if (
          !section.enabled
        ) {
          return {
            amount: 0,
            received: 0,
            rate:
              getRate(
                section
              ),
          };
        }

        const base =
          numberValue(
            section[
              amountField
            ]
          );

        const percentage =
          numberValue(
            section.commission_percent
          );

        return {
          amount:
            base *
            (
              percentage /
              100
            ),

          received:
            numberValue(
              section.received_amount
            ),

          rate:
            getRate(
              section
            ),
        };
      };

      const profitCalculation = (
        section,
        payableField
      ) => {
        if (
          !section.enabled
        ) {
          return {
            amount: 0,
            received: 0,
            rate:
              getRate(
                section
              ),
          };
        }

        const collected =
          numberValue(
            section.total_taken
          );

        const payable =
          numberValue(
            section[
              payableField
            ]
          );

        return {
          amount:
            Math.max(
              0,
              collected -
                payable
            ),

          received:
            numberValue(
              section.received_amount
            ),

          rate:
            getRate(
              section
            ),
        };
      };

      const educationLoan =
        percentageCalculation(
          revenue.education_loan,
          "loan_amount"
        );

      const accommodation =
        percentageCalculation(
          revenue.accommodation,
          "booking_amount"
        );

      const ielts =
        profitCalculation(
          revenue.ielts,
          "actual_cost"
        );

      const tuitionFeeProfit =
        profitCalculation(
          revenue.tuition_fee_profit,
          "amount_payable"
        );

      const visaFeeProfit =
        profitCalculation(
          revenue.visa_fee_profit,
          "amount_payable"
        );

      const servicePackage = {
        amount:
          revenue.service_package
            .enabled
            ? numberValue(
                revenue
                  .service_package
                  .package_fee
              )
            : 0,

        received:
          revenue.service_package
            .enabled
            ? numberValue(
                revenue
                  .service_package
                  .received_amount
              )
            : 0,

        rate:
          getRate(
            revenue.service_package
          ),
      };

      const results = [
        universityResult,
        educationLoan,
        accommodation,
        ielts,
        tuitionFeeProfit,
        visaFeeProfit,
        servicePackage,
      ];

      const expectedInr =
        results.reduce(
          (total, item) =>
            total +
            item.amount *
              item.rate,
          0
        );

      const receivedInr =
        results.reduce(
          (total, item) =>
            total +
            item.received *
              item.rate,
          0
        );

      return {
        grossTuition,
        scholarship,
        netTuition,

        university:
          universityResult,

        educationLoan,
        accommodation,
        ielts,
        tuitionFeeProfit,
        visaFeeProfit,
        servicePackage,

        expectedInr,

        receivedInr,

        balanceInr:
          Math.max(
            0,
            expectedInr -
              receivedInr
          ),
      };
    }, [revenue]);

  const saveRevenue =
    async () => {
      try {
        setSaving(true);

        await api.post(
          `/revenue/${leadId}`,
          {
            revenue,

            totals: {
              expected_inr:
                calculations.expectedInr,

              received_inr:
                calculations.receivedInr,

              balance_inr:
                calculations.balanceInr,
            },
          }
        );

        toast.success(
          "Revenue saved successfully"
        );
      } catch (error) {
        console.error(
          "Unable to save revenue",
          error
        );

        toast.error(
          error?.response?.data
            ?.detail ||
            "Unable to save revenue"
        );
      } finally {
        setSaving(false);
      }
    };

  if (
    user?.role !== "admin"
  ) {
    return null;
  }

  if (loading) {
    return (
      <div className="text-sm text-stone-400 py-4">
        Loading finance information...
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* University Commission */}
      <SectionToggle
        title="University Commission"
        enabled={
          revenue.university
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "university",
            enabled
          )
        }
      >
        <UniversitySection
          data={
            revenue.university
          }
          calculation={
            calculations
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "university",
              field,
              value
            )
          }
        />
      </SectionToggle>

      {/* Education Loan */}
      <SectionToggle
        title="Education Loan"
        enabled={
          revenue
            .education_loan
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "education_loan",
            enabled
          )
        }
      >
        <PercentageSection
          data={
            revenue.education_loan
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "education_loan",
              field,
              value
            )
          }
          organisationLabel="Loan Organisation"
          amountLabel="Loan Amount"
          amountField="loan_amount"
          result={
            calculations.educationLoan
          }
            inrOnly={true}
        />
      </SectionToggle>

      {/* Accommodation */}
      <SectionToggle
        title="Accommodation"
        enabled={
          revenue
            .accommodation
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "accommodation",
            enabled
          )
        }
      >
        <PercentageSection
          data={
            revenue.accommodation
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "accommodation",
              field,
              value
            )
          }
          organisationLabel="Accommodation Organisation"
          amountLabel="Accommodation / Booking Amount"
          amountField="booking_amount"
          result={
            calculations.accommodation
          }
        />
      </SectionToggle>

      {/* IELTS */}
      <SectionToggle
        title="IELTS"
        enabled={
          revenue.ielts.enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "ielts",
            enabled
          )
        }
      >
        <ProfitSection
          data={
            revenue.ielts
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "ielts",
              field,
              value
            )
          }
          payableLabel="Actual IELTS Cost"
          payableField="actual_cost"
          result={
            calculations.ielts
          }
        />
      </SectionToggle>

      {/* Tuition Profit */}
      <SectionToggle
        title="Tuition Fee Profit"
        enabled={
          revenue
            .tuition_fee_profit
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "tuition_fee_profit",
            enabled
          )
        }
      >
        <ProfitSection
          data={
            revenue
              .tuition_fee_profit
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "tuition_fee_profit",
              field,
              value
            )
          }
          payableLabel="Tuition Fee Need to Pay University"
          payableField="amount_payable"
          result={
            calculations
              .tuitionFeeProfit
          }
        />
      </SectionToggle>

      {/* Visa Profit */}
      <SectionToggle
        title="Visa Fee Profit"
        enabled={
          revenue
            .visa_fee_profit
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "visa_fee_profit",
            enabled
          )
        }
      >
        <ProfitSection
          data={
            revenue
              .visa_fee_profit
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "visa_fee_profit",
              field,
              value
            )
          }
          payableLabel="Visa Fee Need to Pay"
          payableField="amount_payable"
          result={
            calculations
              .visaFeeProfit
          }
        />
      </SectionToggle>

      {/* Service Package */}
      <SectionToggle
        title="Rayvoy Service Package"
        enabled={
          revenue
            .service_package
            .enabled
        }
        onChange={(
          enabled
        ) =>
          toggleSection(
            "service_package",
            enabled
          )
        }
      >
        <ServicePackageSection
          data={
            revenue.service_package
          }
          update={(
            field,
            value
          ) =>
            updateSection(
              "service_package",
              field,
              value
            )
          }
          result={
            calculations
              .servicePackage
          }
        />
      </SectionToggle>

      {/* Summary */}
      <div className="bg-[#1B365D] text-white rounded-xl p-5">
        <div className="text-xs text-white/60 uppercase tracking-widest">
          Student Revenue Summary
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <div className="text-xs text-white/60">
              Expected
            </div>

            <div className="font-bold text-xl mt-1">
              {formatMoney(
                calculations.expectedInr,
                "INR"
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60">
              Received
            </div>

            <div className="font-bold text-xl mt-1">
              {formatMoney(
                calculations.receivedInr,
                "INR"
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60">
              Outstanding
            </div>

            <div className="font-bold text-xl mt-1">
              {formatMoney(
                calculations.balanceInr,
                "INR"
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={
            saveRevenue
          }
          disabled={saving}
          className="bg-[#C05B43] hover:bg-[#A64D37]"
        >
          <Save className="w-4 h-4 mr-2" />

          {saving
            ? "Saving..."
            : "Save Revenue"}
        </Button>
      </div>
    </div>
  );
}

function UniversitySection({
  data,
  calculation,
  update,
}) {
  const rate =
    getRate(data);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            University Name
          </label>

          <input
            value={
              data.university_name
            }
            onChange={(e) =>
              update(
                "university_name",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <CurrencyFields
          data={data}
          update={update}
        />

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Original Tuition Fee
          </label>

          <input
            type="number"
            min="0"
            value={
              data.tuition_fee
            }
            onChange={(e) =>
              update(
                "tuition_fee",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Scholarship
          </label>

          <select
            value={
              data.scholarship
            }
            onChange={(e) =>
              update(
                "scholarship",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm"
          >
            <option value="no">
              No
            </option>

            <option value="yes">
              Yes
            </option>
          </select>
        </div>

        {data.scholarship ===
          "yes" && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Scholarship Amount
            </label>

            <input
              type="number"
              min="0"
              value={
                data.scholarship_amount
              }
              onChange={(e) =>
                update(
                  "scholarship_amount",
                  e.target.value
                )
              }
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Commission %
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              data.commission_percent
            }
            onChange={(e) =>
              update(
                "commission_percent",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">

        <AmountConversion
          label="Original Tuition Fee"
          amount={
            calculation.grossTuition
          }
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Scholarship"
          amount={
            calculation.scholarship
          }
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Tuition After Scholarship"
          amount={
            calculation.netTuition
          }
          currency={
            data.currency
          }
          rate={rate}
        />

      </div>

      <RevenueResult
        label="University Commission"
        amount={
          calculation
            .university
            .amount
        }
        received={
          calculation
            .university
            .received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}

function PercentageSection({
  data,
  update,
  organisationLabel,
  amountLabel,
  amountField,
  result,
  inrOnly = false,
}) {
  const rate =
    getRate(data);

  const amount =
    numberValue(
      data[amountField]
    );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            {organisationLabel}
          </label>

          <input
            value={
              data.organisation
            }
            onChange={(e) =>
              update(
                "organisation",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        {!inrOnly && (
          <CurrencyFields
            data={data}
            update={update}
          />
        )}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            {amountLabel}
          </label>

          <input
            type="number"
            min="0"
            value={
              data[
                amountField
              ]
            }
            onChange={(e) =>
              update(
                amountField,
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Commission %
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              data.commission_percent
            }
            onChange={(e) =>
              update(
                "commission_percent",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="mt-4">
        <AmountConversion
          label={
            amountLabel
          }
          amount={amount}
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Calculated Commission"
        amount={
          result.amount
        }
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}

function ProfitSection({
  data,
  update,
  payableLabel,
  payableField,
  result,
}) {
  const rate =
    getRate(data);

  const payable =
    numberValue(
      data[
        payableField
      ]
    );

  const totalTaken =
    numberValue(
      data.total_taken
    );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        <CurrencyFields
          data={data}
          update={update}
        />

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            {payableLabel}
          </label>

          <input
            type="number"
            min="0"
            value={
              data[
                payableField
              ]
            }
            onChange={(e) =>
              update(
                payableField,
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Total Amount Taken
          </label>

          <input
            type="number"
            min="0"
            value={
              data.total_taken
            }
            onChange={(e) =>
              update(
                "total_taken",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">

        <AmountConversion
          label={
            payableLabel
          }
          amount={
            payable
          }
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Total Amount Taken"
          amount={
            totalTaken
          }
          currency={
            data.currency
          }
          rate={rate}
        />

      </div>

      <RevenueResult
        label="Calculated Profit"
        amount={
          result.amount
        }
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}

function ServicePackageSection({
  data,
  update,
  result,
}) {
  const rate =
    getRate(data);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Package Type
          </label>

          <select
            value={
              data.package_type
            }
            onChange={(e) =>
              update(
                "package_type",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm"
          >
            <option value="">
              Select package
            </option>

            <option value="germany">
              Germany
            </option>

            <option value="top_university">
              Top University
            </option>

            <option value="custom">
              Custom
            </option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Package Name
          </label>

          <input
            value={
              data.package_name
            }
            onChange={(e) =>
              update(
                "package_name",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <CurrencyFields
          data={data}
          update={update}
        />

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">
            Package Fee
          </label>

          <input
            type="number"
            min="0"
            value={
              data.package_fee
            }
            onChange={(e) =>
              update(
                "package_fee",
                e.target.value
              )
            }
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="mt-4">
        <AmountConversion
          label="Package Fee"
          amount={
            numberValue(
              data.package_fee
            )
          }
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Service Package Revenue"
        amount={
          result.amount
        }
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}
