function errText(error){ //debugging function
    try{
        _internalId = nlapiGetRecordId();
        if(!(typeof _internalId==='number' && (_internalId%1)===0)) {
            _internalId = 0;
        }
    } catch (e){
      _internalId = 0;
    }
    var txt='';
    if (error instanceof nlobjError) {
        //this is netsuite specific error
        txt = 'NLAPI Error: Record ID :: '+_internalId+' :: '+error.getCode()+' :: '+error.getDetails() + ' :: ' + error.getStackTrace().join(', ');
    } else {
        //this is generic javascript error
        txt = 'JavaScript/Other Error: Record ID :: '+_internalId+' :: '+error.toString()+' : '+error.stack;
    }
    return txt;
}
function getPreferredVendor(record){
  var vendLine = record.findLineItemValue("itemvendor","preferredvendor","T");
  if (vendLine == -1){ //if no preferred vendors
    return -1;
  }
  return nlapiLoadRecord("vendor",record.getLineItemValue("itemvendor","vendor",vendLine));
}
function getSFparam(recordType,nomeOfIdField,recordId,fieldToSearchFor) {//gets the parameter that only the search field can provide
  var filters = [
    new nlobjSearchFilter(nomeOfIdField, null, 'is', recordId)
  ]; //filters for this record

  var columns = [
    new nlobjSearchColumn(nomeOfIdField),
    new nlobjSearchColumn(fieldToSearchFor),
  ]; //finds the field this function is searching for
  var value;
  var search = nlapiSearchRecord(recordType, null, filters, columns);
  for (var i = 0; i < search.length; i++) {
    value = search[i].getValue(new nlobjSearchColumn(fieldToSearchFor))
  }
  return value;
}
function getStandardCost(record){
  return getSFparam(record.getRecordType(),"internalid",record.getId(),"currentstandardcost");
}
function calculateFreightCost(vendor, item){
  var costType = vendor.getFieldValue("custentityfreightcalcmeth"); //get the method of freight calculation
  var freightFactor = vendor.getFieldValue("custentityfreightfactor"); //get the number necessary to calculate the freight cost
  var FreightCost;
  if (costType == null || freightFactor == null){
    return -1;
  }
  switch(costType) {
    case 1: //if it's a percent type freight cost
      FreightCost = getStandardCost(item)*freightFactor/100.0;
      break;
    case 2: //if it's calculated by weight
      var weight = item.getFieldValue("weight");
      if (weight == null){
        return -1;
      }
      FreightCost = weight*freightFactor;
      break;
    case 3: //if it's a flat fee
      FreightCost = freightFactor;
      break;
  }
  return FreightCost;
}
function main(type){
  var curRec = nlapiLoadRecord(nlapiGetRecordType(),nlapiGetRecordId()); //get the current record
  if (nlapiGetFieldValue("custitemautocalcfreight") == "T" //if the auto calculate freight checkbox is checked 
  && ( nlapiGetRecordType() == "inventoryitem" || curRec.getLineItemValue("locations","supplytype",1) == "PURCHASE")){ //if the item is in stock or planning to be purchased
    var vendor = getPreferredVendor(curRec);
    if (vendor == -1) { //if there's no vendor
      return 0;
    }
    var freightCost = calculateFreightCost(vendor, curRec);
    if (freightCost == -1) { //if the vendor doesn't have a freight cost
      return 0;
    }
    nlapiSetFieldValue("custitemincomingfreightcost",freightCost);
  }
}

function saveRec(type){
  try {
    main(type);
  } catch (e) {
    nlapiLogExecution("error"," error has occurred:",errText(e))
  } finally {
    return true;
  }
}

