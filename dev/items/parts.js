for (var i = 0; i < RSE_ITEMS.parts.length; i++) {
	var storagePartDefinition = RSE_ITEMS.parts[i];
	IDRegistry.genItemID(storagePartDefinition.id);
	var itemCreationResult = Item.createItem(storagePartDefinition.id, storagePartDefinition.name, { name: storagePartDefinition.texture }, { stack: 64 });
	RSE.itemCreated[storagePartDefinition.id] = !!itemCreationResult;
	RSE.itemReady[storagePartDefinition.id] = !!itemCreationResult;
}
