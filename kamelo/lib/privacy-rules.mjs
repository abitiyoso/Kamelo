export const privacyKinds = ["COPY", "CORRECTION", "DELETION", "CLOSE_ACCOUNT"];
export const privacyStatuses = [
  "SUBMITTED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "RESPONDED",
  "DECLINED",
  "CANCELLED",
];
export const privacyOpen = ["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"];
export function privacyNext(platform, action, current, desired) {
  if (!privacyStatuses.includes(current))
    throw Error("Status permintaan tidak valid.");
  if (action === "reply") {
    if (!privacyOpen.includes(current))
      throw Error("Permintaan sudah ditutup. Buka kembali sebelum membalas.");
    return current === "NEEDS_INFORMATION" && !platform ? "IN_REVIEW" : current;
  }
  if (action === "cancel" && !platform && privacyOpen.includes(current))
    return "CANCELLED";
  if (
    action === "reopen" &&
    !platform &&
    ["RESPONDED", "DECLINED"].includes(current)
  )
    return "SUBMITTED";
  if (
    action === "review" &&
    platform &&
    privacyOpen.includes(current) &&
    ["IN_REVIEW", "NEEDS_INFORMATION", "RESPONDED", "DECLINED"].includes(
      desired,
    ) &&
    desired !== current
  ) {
    if (["RESPONDED", "DECLINED"].includes(desired) && current !== "IN_REVIEW")
      throw Error("Tinjau permintaan sebelum mencatat keputusan.");
    return desired;
  }
  throw Error("Perubahan permintaan tidak diizinkan.");
}
