var RSE_processorDefinitions = [
	RSE_ITEMS.processors.raw,
	RSE_ITEMS.processors.neural,
	RSE_ITEMS.processors.craftingUpgrade
];

for (var i = 0; i < RSE_processorDefinitions.length; i++) {
	var processorDefinition = RSE_processorDefinitions[i];
	IDRegistry.genItemID(processorDefinition.id);
	var itemCreationResult = Item.createItem(processorDefinition.id, processorDefinition.name, { name: processorDefinition.texture }, { stack: 64 });
	RSE.itemCreated[processorDefinition.id] = !!itemCreationResult;
	RSE.itemReady[processorDefinition.id] = !!itemCreationResult;
}
