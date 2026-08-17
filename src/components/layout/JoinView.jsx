import React from "react";
import { cardStyle } from "../../styles";
import { NameStep } from "../join/NameStep";
import { PaymentStep } from "../join/PaymentStep";
import { EntrySubmitted } from "../join/EntrySubmitted";

export function JoinView({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  nameSubmitted,
  setNameSubmitted,
  fullName,
  config,
  emptyCount,
  amount,
  setAmount,
  squaresForAmount,
  requestSubmitted,
  requestedCount,
  submitting,
  submitError,
  onSubmitRequest,
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

      {!requestSubmitted ? (
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
              config={config}
              emptyCount={emptyCount}
              amount={amount}
              setAmount={setAmount}
              squaresForAmount={squaresForAmount}
              submitting={submitting}
              submitError={submitError}
              onConfirm={onSubmitRequest}
              onViewBoard={onViewBoard}
            />
          )}
        </div>
      ) : (
        <EntrySubmitted
          fullName={fullName}
          requestedCount={requestedCount}
          amount={amount}
          pricePerSquare={config.pricePerSquare}
          onViewBoard={onViewBoard}
          onDone={onDone}
        />
      )}
    </div>
  );
}
