// src/services/zoneService.ts
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import type {
  ZoneStep1Data,
  ZoneStep2Data,
  ZoneStep3Data,
  ZoneBranchLocation,
  ZoneBranchSetup,
} from "../store/zoneOnboardingStore";
import { normalizePhoneForSave } from "./userService";

/** Shape we’ll save for a new zone + primary branch */
export interface ZoneRegistrationSteps {
  step1: ZoneStep1Data;
  step2: ZoneStep2Data;
  step3: ZoneStep3Data;
}

function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeBranchSetup(
  setup?: ZoneBranchSetup
): ZoneBranchSetup {
  return {
    branchDisplayName: setup?.branchDisplayName?.trim() || "",
    supportsCs2: !!setup?.supportsCs2,
    supportsFc25: !!setup?.supportsFc25,
    supportsTekken8: !!setup?.supportsTekken8,
    supportsFutsal: !!setup?.supportsFutsal,
    supportsIndoorCricket: !!setup?.supportsIndoorCricket,
    supportsPadel: !!setup?.supportsPadel,
    supportsPickleball: !!setup?.supportsPickleball,
    pcSeats: setup?.pcSeats?.trim() || "",
    consoleSeats: setup?.consoleSeats?.trim() || "",
    consolePlatform: setup?.consolePlatform?.trim() || "",
    futsalCourts: setup?.futsalCourts?.trim() || "",
    futsalCourtType: setup?.futsalCourtType?.trim() || "",
    indoorCricketNets: setup?.indoorCricketNets?.trim() || "",
    indoorCricketSurface: setup?.indoorCricketSurface?.trim() || "",
    padelCourts: setup?.padelCourts?.trim() || "",
    padelCourtSurface: setup?.padelCourtSurface?.trim() || "",
    pickleballCourts: setup?.pickleballCourts?.trim() || "",
    pickleballSurface: setup?.pickleballSurface?.trim() || "",
  };
}

/**
 * Save a new zone document for the currently signed-in user.
 * Assumes auth user already exists (created via signUpWithEmail).
 */
export async function saveZoneRegistration(
  data: ZoneRegistrationSteps
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = auth.currentUser;

  if (!user) {
    return {
      ok: false,
      message: "Not signed in. Please log in again before submitting your zone.",
    };
  }

  try {
    const { step1, step2, step3 } = data;

    const zonesRef = collection(db, "zones");

    const normalizedPhone = step1.contactPhone
      ? normalizePhoneForSave(step1.contactPhone)
      : null;

    const allBranches: ZoneBranchLocation[] =
      step2.branches && step2.branches.length > 0
        ? step2.branches
        : [
            {
              branchDisplayName: step2.branchDisplayName || "",
              city: step2.city || "",
              areaLabel: step2.areaLabel || "",
              addressLine1: step2.addressLine1 || "",
              googleMapsUrl: step2.googleMapsUrl || "",
            },
          ];

    const allSetups: ZoneBranchSetup[] =
      step3.branchSetups && step3.branchSetups.length > 0
        ? step3.branchSetups
        : [
            {
              branchDisplayName:
                step2.branchDisplayName || allBranches[0]?.branchDisplayName || "",
              supportsCs2: false,
              supportsFc25: false,
              supportsTekken8: false,
              supportsFutsal: false,
              supportsIndoorCricket: false,
              supportsPadel: false,
              supportsPickleball: false,
              pcSeats: "",
              consoleSeats: "",
              consolePlatform: "",
              futsalCourts: "",
              futsalCourtType: "",
              indoorCricketNets: "",
              indoorCricketSurface: "",
              padelCourts: "",
              padelCourtSurface: "",
              pickleballCourts: "",
              pickleballSurface: "",
            },
          ];

    const branchRecords = allBranches.map((branch, idx) => {
      const setup = normalizeBranchSetup(allSetups[idx] || allSetups[0]);
      return {
        branchDisplayName: branch.branchDisplayName.trim() || null,
        city: branch.city.trim() || null,
        areaLabel: branch.areaLabel.trim() || null,
        addressLine1: branch.addressLine1.trim() || null,
        googleMapsUrl: branch.googleMapsUrl.trim() || null,
        games: {
          supportsCs2: setup.supportsCs2,
          supportsFc25: setup.supportsFc25,
          supportsTekken8: setup.supportsTekken8,
          supportsFutsal: setup.supportsFutsal,
          supportsIndoorCricket: setup.supportsIndoorCricket,
          supportsPadel: setup.supportsPadel,
          supportsPickleball: setup.supportsPickleball,
        },
        capacity: {
          pcSeats: toIntOrNull(setup.pcSeats),
          consoleSeats: toIntOrNull(setup.consoleSeats),
          consolePlatform: setup.consolePlatform || null,
          futsalCourts: toIntOrNull(setup.futsalCourts),
          futsalCourtType: setup.futsalCourtType || null,
          indoorCricketNets: toIntOrNull(setup.indoorCricketNets),
          indoorCricketSurface: setup.indoorCricketSurface || null,
          padelCourts: toIntOrNull(setup.padelCourts),
          padelCourtSurface: setup.padelCourtSurface || null,
          pickleballCourts: toIntOrNull(setup.pickleballCourts),
          pickleballSurface: setup.pickleballSurface || null,
        },
      };
    });

    const primaryBranch = branchRecords[0];
    const additionalBranches = branchRecords.slice(1);

    const aggregatedGames = branchRecords.reduce(
      (acc, branch) => ({
        supportsCs2: acc.supportsCs2 || !!branch.games.supportsCs2,
        supportsFc25: acc.supportsFc25 || !!branch.games.supportsFc25,
        supportsTekken8: acc.supportsTekken8 || !!branch.games.supportsTekken8,
        supportsFutsal: acc.supportsFutsal || !!branch.games.supportsFutsal,
        supportsIndoorCricket:
          acc.supportsIndoorCricket || !!branch.games.supportsIndoorCricket,
        supportsPadel: acc.supportsPadel || !!branch.games.supportsPadel,
        supportsPickleball: acc.supportsPickleball || !!branch.games.supportsPickleball,
      }),
      {
        supportsCs2: false,
        supportsFc25: false,
        supportsTekken8: false,
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
      }
    );

    const docBody = {
      ownerUid: user.uid,
      ownerFullName: step1.ownerFullName.trim(),
      venueBrandName: step1.venueBrandName.trim(),
      contactEmail: step1.contactEmail.trim().toLowerCase(),
      contactPhone: normalizedPhone,

      status: "pending-review" as const,
      onboardingStep: 4,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      primaryBranch,

      additionalBranches,

      games: aggregatedGames,

      capacity: primaryBranch?.capacity || null,

      branches: branchRecords,

      notes: step3.notes?.trim() || null,
    };

    await addDoc(zonesRef, docBody);

    return { ok: true };
  } catch (e) {
    console.log("[zoneService] saveZoneRegistration error", e);
    return {
      ok: false,
      message: "Could not save your zone. Please try again.",
    };
  }
}
