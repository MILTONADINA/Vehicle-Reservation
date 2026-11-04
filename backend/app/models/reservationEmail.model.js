// One internal email notification for a reservation request: a frozen message snapshot plus delivery bookkeeping.
// notificationKey is the new status for status_change jobs and the departureDate for pickup_reminder jobs,
// so the named unique index allows one job per request event.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "reservationEmail",
    {
      reservationRequestId: { type: DataTypes.INTEGER, allowNull: false },
      kind: { type: DataTypes.ENUM("status_change", "pickup_reminder"), allowNull: false },
      notificationKey: { type: DataTypes.STRING(32), allowNull: false },
      recipient: { type: DataTypes.STRING(254), allowNull: false },
      subject: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      deliveryState: {
        type: DataTypes.ENUM("pending", "sent", "failed", "skipped"),
        allowNull: false,
        defaultValue: "pending",
      },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      nextAttemptAt: { type: DataTypes.DATE, allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
      indexes: [
        {
          name: "reservation_emails_request_kind_key",
          unique: true,
          fields: ["reservationRequestId", "kind", "notificationKey"],
        },
      ],
    }
  );
