var RSE_ITEMS = {
	disks: [
		{ id: "RSE_storage_disk_256k", name: "256k Storage Disk", texture: "disk_256k", capacity: 256000, partId: "RSE_storage_part_256k" },
		{ id: "RSE_storage_disk_1024k", name: "1024k Storage Disk", texture: "disk_1024k", capacity: 1024000, partId: "RSE_storage_part_1024k" },
		{ id: "RSE_storage_disk_4096k", name: "4096k Storage Disk", texture: "disk_4096k", capacity: 4096000, partId: "RSE_storage_part_4096k" },
		{ id: "RSE_storage_disk_16384k", name: "16384k Storage Disk", texture: "disk_16384k", capacity: 16384000, partId: "RSE_storage_part_16384k" }
	],
	parts: [
		{ id: "RSE_storage_part_256k", name: "256k Storage Part", texture: "part_256k" },
		{ id: "RSE_storage_part_1024k", name: "1024k Storage Part", texture: "part_1024k" },
		{ id: "RSE_storage_part_4096k", name: "4096k Storage Part", texture: "part_4096k" },
		{ id: "RSE_storage_part_16384k", name: "16384k Storage Part", texture: "part_16384k" }
	],
	processors: {
		raw: { id: "RSE_raw_neural_processor", name: "Raw Neural Processor", texture: "raw_neural_processor" },
		neural: { id: "RSE_neural_processor", name: "Neural Processor", texture: "neural_processor" },
		craftingUpgrade: { id: "RSE_crafting_upgrade", name: "Crafting Upgrade", texture: "rs_crafting_upgrade" }
	},
	cards: [
		{ id: "RSE_infinity_card", name: "Infinity Range Booster", texture: "infinity_card", usageKey: "infinityUsage", defaultUsage: 4000, crossDimension: false },
		{ id: "RSE_dimension_card", name: "Dimension Card", texture: "dimension_card", usageKey: "dimensionUsage", defaultUsage: 8000, crossDimension: true }
	],
	wcg: { id: "RSE_wireless_crafting_grid", name: "Wireless Crafting Grid", texture: "wireless_crafting_grid_inactive" }
};
