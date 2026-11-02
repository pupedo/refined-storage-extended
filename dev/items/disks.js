for (var i = 0; i < RSE_ITEMS.disks.length; i++) {
	var storageDiskDefinition = RSE_ITEMS.disks[i];
	IDRegistry.genItemID(storageDiskDefinition.id);
	var itemCreationResult = Item.createItem(storageDiskDefinition.id, storageDiskDefinition.name, { name: storageDiskDefinition.texture }, { stack: 1, isTech: true });
	RSE.itemCreated[storageDiskDefinition.id] = !!itemCreationResult;
	RSE.itemReady[storageDiskDefinition.id] = false;
	if (!itemCreationResult) {
		RSE.log("item creation failed: " + storageDiskDefinition.id);
	} else {
		try { Item.setFireResistant(ItemID[storageDiskDefinition.id], true); } catch (e) {}
	}
}

ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
	if (!api || !api.disks) {
		RSE.log("disks skipped: RefinedStorageAPI unavailable");
		return;
	}
	if (!RSE.apiAtLeast(api, 2, 0)) {
		RSE.log("disks skipped: RefinedStorageAPI 2.0 required");
		return;
	}
	for (var i = 0; i < RSE_ITEMS.disks.length; i++) {
		var storageDiskDefinition = RSE_ITEMS.disks[i];
		var registrationResult = api.disks.register(storageDiskDefinition.name, storageDiskDefinition.texture, storageDiskDefinition.capacity, storageDiskDefinition.id);
		if (registrationResult == -1) {
			RSE.log("disk skipped: capacity already registered: " + storageDiskDefinition.capacity + " (" + storageDiskDefinition.id + ")");
		}
		RSE.itemReady[storageDiskDefinition.id] = !!RSE.itemCreated[storageDiskDefinition.id] && typeof registrationResult === 'number' && registrationResult > 0;
		if (RSE.itemReady[storageDiskDefinition.id]) Item.addToCreative(ItemID[storageDiskDefinition.id], 1, 0);
	}
	RSE.logDev("extended disks registered");
});
