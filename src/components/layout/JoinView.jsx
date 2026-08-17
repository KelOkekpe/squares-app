import React from "react";
import { cardStyle } from "../../styles";
import { NameStep } from "../join/NameStep";
import { PaymentStep } from "../join/PaymentStep";
import { PaymentSuccess } from "../join/PaymentSuccess";

export function JoinView({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  nameSubmitted,
  setNameSubmitted,
  fullName,
  qrMemo,
  config,
  emptyCount,
  amount,
  setAmount,
  squaresForAmount,
  paymentSent,
  addedCount,
  onConfirmPayment,
  onViewBoard,
  onBack,
  onDone,
}) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "#6c5ce7",
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 20,
          padding: 0,
          fontWeight: 600,
        }}
      >
        ← Back
      </button>

      {!paymentSent ? (
        <div style={cardStyle}>
          <NameStep
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            nameSubmitted={nameSubmitted}
            setNameSubmitted={setNameSubmitted}
            fullName={fullName}
          />

          {nameSubmitted && (
            <PaymentStep
              qrMemo={qrMemo}
              config={config}
              emptyCount={emptyCount}
              amount={amount}
              setAmount={setAmount}
              squaresForAmount={squaresForAmount}
              onConfirm={onConfirmPayment}
              onViewBoard={onViewBoard}
            />
          )}
        </div>
      ) : (
        <PaymentSuccess
          fullName={fullName}
          addedCount={addedCount}
          amount={amount}
          pricePerSquare={config.pricePerSquare}
          onViewBoard={onViewBoard}
          onDone={onDone}
        />
      )}
    </div>
  );
}
