const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify");
const fs = require("fs");
const { uniq, includes, intersection } = require("lodash");
const XRegExp = require('xregexp');

const customerFile = "export_customer_20240301_062141";
const customerAddressFile = "export_customer_address_20240301_062212";
const orderFile = "sales_order-2024-03-05_1938";
const orderItemFile = "sales_order_item-2024-03-05_1936";
const orderAddressFile = "sales_order_address-2024-03-05_1942";
const orderPaymentFile = "sales_order_payment-2024-03-05_1943";
const orderStatusHistoryFile = "sales_order_status_history-2024-03-05_1945";
const shipmentTrackFile = "sales_shipment_track-2024-03-05_1945";

const config = {
    customer_save_to_csv: true
}

function main() {
    const customers = readCSV(customerFile);
    const orders = readCSV(orderFile);
    const orderItems = readCSV(orderItemFile);
    const orderAddresses = readCSV(orderAddressFile);
    const orderPayments = readCSV(orderPaymentFile);
    const orderStatusHistory = readCSV(orderStatusHistoryFile);
    const shipmentTracks = readCSV(shipmentTrackFile);

    const customeremails = uniq(orders.map(o => o.customer_email));
    console.log("order file emails count:", customeremails.length);

    const allcustomeremails = uniq(customers.map(c => c.email));
    console.log("customer file emails count:", allcustomeremails.length);

    const customeremailintersection = intersection(customeremails, allcustomeremails);

    const filteredCustomers = [];
    const chineseNamesCustomers = [];
    const urlNamesCustomers = [];

    for (const customer of customers) {
        const chineseNames = findChineseNames(customer.firstname);

        if (chineseNames.length > 0) {
            chineseNamesCustomers.push(customer);
        }
        else if (includes(customer.firstname, "www.tinyurl.com")) {
            urlNamesCustomers.push(customer);
        }
        else if (includes(customer.firstname, "https://")) {
            urlNamesCustomers.push(customer);
        }
        else if (includes(customer.firstname, "http://")) {
            urlNamesCustomers.push(customer);
        }
        else if (includes(customer.firstname, "www.")) {
            urlNamesCustomers.push(customer);
        }
        else {
            filteredCustomers.push(customer);
        }
    }

    console.log("filtered customers count:", filteredCustomers.length);
    console.log("chinese names customers count:", chineseNamesCustomers.length);
    console.log("url names customers count:", urlNamesCustomers.length);

    writeCSV(
        "trash/customer",
        Object.keys(customers[0]),
        [...chineseNamesCustomers, ...urlNamesCustomers]
    );

    const pCustomers = filteredCustomers;
    console.log("customers to process:", customeremailintersection.length);

    const processedCustomers = processCustomers(pCustomers, customeremailintersection);
    console.log("processesed customer count:", processedCustomers.length);

    const processedCustomerAddresses = processCustomerAddresses(readCSV(customerAddressFile), customeremailintersection, { save_to_csv: true });
    console.log("processesed customer address count:", processedCustomerAddresses.length);

    const processedOrders = processOrders(orders, customeremailintersection, { save_to_csv: true });
    console.log("processesed order count:", processedOrders.length);
    const onlyTheseOrderIds = processedOrders.map(o => o.entity_id);

    const processedOrderItems = processOrderItems(orderItems, onlyTheseOrderIds, { save_to_csv: true });
    console.log("processesed order item count:", processedOrderItems.length);

    const processedOrderAddresses = processOrderAddresses(orderAddresses, onlyTheseOrderIds, { save_to_csv: true });
    console.log("processesed order address count:", processedOrderAddresses.length);

    const processedOrderPayments = processOrderPayment(orderPayments, onlyTheseOrderIds, { save_to_csv: true });
    console.log("processesed order payment count:", processedOrderPayments.length);

    const processedOrderStatusHistory = processOrderStatusHistory(orderStatusHistory, onlyTheseOrderIds, { save_to_csv: true });
    console.log("processesed order status history count:", processedOrderStatusHistory.length);

    const processedShipmentTracks = processShipmentTrack(shipmentTracks, onlyTheseOrderIds, { save_to_csv: true });
    console.log("processesed shipment track count:", processedShipmentTracks.length);
}

function findChineseNames(text) {
    const chinesePattern = XRegExp('\\p{Han}+', 'g');
    const chineseNames = XRegExp.match(text, chinesePattern);
    return chineseNames;
}

function processShipmentTrack(shipmentTracks, onlyTheseOrderIds, input) {
    if (input?.save_to_csv) {
        const rows = shipmentTracks.filter(op => onlyTheseOrderIds.includes(op.parent_id));
        writeCSV(
            "order/shipment_track",
            Object.keys(shipmentTracks[0]),
            rows
        );
        return rows;
    }
    return shipmentTracks;
}

function processOrderStatusHistory(orderStatusHistory, onlyTheseOrderIds, input) {
    if (input?.save_to_csv) {
        const rows = orderStatusHistory.filter(op => onlyTheseOrderIds.includes(op.parent_id));
        writeCSV(
            "order/order_status_history",
            Object.keys(orderStatusHistory[0]),
            rows
        );
        return rows;
    }
    return orderStatusHistory;
}

function processOrderPayment(orderPayments, onlyTheseOrderIds, input) {
    if (input?.save_to_csv) {
        const rows = orderPayments.filter(op => onlyTheseOrderIds.includes(op.parent_id));
        writeCSV(
            "order/order_payment",
            Object.keys(orderPayments[0]),
            rows
        );
        return rows;
    }
    return orderPayments;
}

function processOrderAddresses(orderAddresses, onlyTheseOrderIds, input) {
    const rows = orderAddresses.filter(oa => onlyTheseOrderIds.includes(oa.parent_id));
    if (input?.save_to_csv) {
        writeCSV(
            "order/order_address",
            Object.keys(orderAddresses[0]),
            rows
        );
    }
    return rows;
}

function processOrderItems(orderItems, onlyTheseOrderIds, input) {
    if (input?.save_to_csv) {
        const rows = orderItems.filter(oi => onlyTheseOrderIds.includes(oi.order_id));
        writeCSV(
            "order/order_item",
            Object.keys(orderItems[0]),
            rows
        );
        return rows;
    }
    return orderItems;
}

function processOrders(orders, onlyTheseEmails, input) {
    const rows = orders.filter(order => onlyTheseEmails.includes(order.customer_email));
    if (input?.save_to_csv) {
        writeCSV(
            "order/order",
            Object.keys(orders[0]),
            rows
        );
    }
    return rows;
}


function processCustomerAddresses(customerAddresses, onlyTheseEmails, input) {
    if (input?.save_to_csv) {
        const rows = customerAddresses.filter(ca => onlyTheseEmails.includes(ca._email));
        writeCSV(
            "customer/customer_address",
            Object.keys(customerAddresses[0]),
            rows
        );
        return rows;
    }
    return customerAddresses;
}

function processCustomers(customers, onlyTheseEmails) {
    if (config.customer_save_to_csv) {
        const rows = customers.filter(c => onlyTheseEmails.includes(c.email));
        writeCSV(
            "customer/customer",
            Object.keys(customers[0]),
            rows
        );
        return rows;
    } else {
        console.log("do not save to csv.");
    }
    return customers;
}

function readCSV(fileName) {
    console.log("reading csv:", fileName);
    const data = parse(
        fs.readFileSync(`./data/${fileName}.csv`, "utf8"),
        {
            columns: (headers) => headers.map(header => header),
        }
    );
    console.log(fileName, "count:", data.length);
    return data;
}

function writeCSV(fileName, columns, rows) {
    console.log("writing", fileName);
    const writableStream = fs.createWriteStream(`./output/${fileName}.csv`);
    const stringifier = stringify({ header: true, columns: columns });
    rows.forEach(row => {
        stringifier.write(row)
    });
    stringifier.pipe(writableStream);
    console.log("finished writing csv:", fileName);
}

main();