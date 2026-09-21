export function isStandaloneLegacyBookingRequest(request: any): boolean {
  return !!request
    && (request.workflowVersion === undefined || request.workflowVersion === "legacy_v1")
    && !request.requestKind
    && !request.matchroomId
    && !request.lifecycleStatus
    && !request.allocatedBranchId
    && (!Array.isArray(request.allocatedResourceIds) || request.allocatedResourceIds.length === 0);
}

export function isLegacyZoneOffer(offer: any): boolean {
  return !!offer
    && !offer.offerType
    && !offer.requestKind
    && !offer.resolvedMatchroomId
    && !offer.branchId
    && (!Array.isArray(offer.resourceIds) || offer.resourceIds.length === 0)
    && (!Array.isArray(offer.scheduleOptions) || offer.scheduleOptions.length === 0);
}
