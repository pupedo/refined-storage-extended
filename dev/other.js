var cts = function (coords) {
	return coords.x + (coords.y != undefined ? "," + coords.y : "") + "," + coords.z;
}

var compareCoords = function (_coords1, _coords2) {
	if (_coords1.x == _coords2.x && _coords1.y == _coords2.y && _coords1.z == _coords2.z) return true;
	return false;
}

function getItemUid(item) {
	if (typeof CoreKit !== 'undefined' && CoreKit.Items && typeof CoreKit.Items.uidOf == 'function') {
		return CoreKit.Items.uidOf(item);
	}
	var extra = item.extra && typeof item.extra.getValue == 'function' ? item.extra.getValue() : 0;
	return item.id + '_' + item.data + (extra ? '_' + extra : '');
}

function cutNumber(num, forGrid) {
	var num2, num3;
	return num > 999 ? (num > 999999 ? (num > 999999999 ? ((num3 = (num / 1000000000)) % 1 && (!forGrid || num3 <= 9.95) ? num3.toFixed(1) : Math.round(num3)) + 'B' : ((num2 = (num / 1000000)) % 1 && (!forGrid || num2 <= 9.95) ? num2.toFixed(1) : Math.round(num2)) + 'M') : ((num2 = (num / 1000)) % 1 && (!forGrid || num2 <= 9.95) ? num2.toFixed(1) : Math.round(num2)) + 'K') : num;
}

function fullExtraToString(extra, usenbt) {
	if (!extra) return "";
	var str = "";
	var jsonExtra;
	if ((jsonExtra = extra.asJson())) {
		var _value;
		if ((_value = jsonExtra.opt('data')) && _value.length() == 0) jsonExtra.remove('data');
		if ((_value = jsonExtra.opt('name')) && _value.length() == 0) jsonExtra.remove('name');
		str += jsonExtra.toString();
	}
	return str;
}

function copyItem(item) {
	return { id: item.id, count: item.count, data: item.data, extra: item.extra || null };
}

function coreId(name) {
	var id = ItemID[name] || BlockID[name];
	if (!id) RSE.log("missing core item/block: " + name);
	return id || 0;
}
