const { sendEmail, sendSMS } = require('../services/notifications');

// Send notification when new donation is posted nearby
async function notifyNearbyUsers(io, donation, nearbyUsers) {
  const donorName = donation.donor.name;
  const foodType = donation.foodType;
  const quantity = `${donation.quantity.amount} ${donation.quantity.unit}`;

  // Email notifications
  for (const user of nearbyUsers) {
    if (user.role === 'ngo' || user.role === 'requester') {
      try {
        await sendEmail({
          to: user.email,
          subject: 'New Food Donation Available Nearby',
          text: `A new donation of ${foodType} (${quantity}) is available near you from ${donorName}. Check the app for details.`,
          html: `<p>A new donation of <strong>${foodType}</strong> (${quantity}) is available near you from <strong>${donorName}</strong>.</p><p>Check the app for details.</p>`
        });

        await sendSMS({
          to: user.phone,
          message: `New food donation: ${foodType} (${quantity}) from ${donorName}. Check the app!`
        });
      } catch (error) {
        console.error('Failed to send notification to user:', user._id, error.message);
      }
    }
  }
}

// Send notification when request is accepted
async function notifyRequestAccepted(io, request) {
  const acceptorName = request.acceptedBy.donor
    ? request.acceptedBy.donor.name
    : request.acceptedBy.ngo.organizationName || request.acceptedBy.ngo.name;

  try {
    await sendEmail({
      to: request.requester.email,
      subject: 'Your Food Request Has Been Accepted!',
      text: `Great news! Your request "${request.title}" has been accepted by ${acceptorName}.`,
      html: `<p>Great news! Your request <strong>"${request.title}"</strong> has been accepted by <strong>${acceptorName}</strong>.</p>`
    });

    await sendSMS({
      to: request.requester.phone,
      message: `Your request "${request.title}" accepted by ${acceptorName}!`
    });

    // Notify acceptor (donor/ngo) about requester contact info
    const acceptor = request.acceptedBy.donor || request.acceptedBy.ngo;
    await sendSMS({
      to: acceptor.phone,
      message: `You accepted a food request! Requester: ${request.requester.name}, Phone: ${request.requester.phone}. Please contact them to arrange pickup/delivery.`
    });
  } catch (error) {
    console.error('Failed to send request accepted notification:', error.message);
  }
}

// Send notification when delivery status changes
async function notifyDeliveryStatusChange(io, delivery, oldStatus, newStatus) {
  const donorName = delivery.donor.name;
  const requesterName = delivery.requester.name;
  const ngoName = delivery.ngo.organizationName || delivery.ngo.name;

  let subject, text, html, recipient;

  switch (newStatus) {
    case 'pickup_started':
      recipient = delivery.donor;
      subject = 'NGO Started Pickup of Your Donation';
      text = `NGO ${ngoName} has started picking up your ${delivery.donation.foodType} donation.`;
      html = `<p><strong>${ngoName}</strong> has started picking up your <strong>${delivery.donation.foodType}</strong> donation.</p>`;
      break;

    case 'pickup_completed':
      recipient = delivery.donor;
      subject = 'Your Donation Has Been Picked Up';
      text = `NGO ${ngoName} has successfully picked up your ${delivery.donation.foodType} donation and is delivering it to ${requesterName}.`;
      html = `<p><strong>${ngoName}</strong> has successfully picked up your <strong>${delivery.donation.foodType}</strong> donation and is delivering it to <strong>${requesterName}</strong>.</p>`;

      // Also notify requester
      await sendEmail({
        to: delivery.requester.email,
        subject: 'Your Food is on the Way!',
        text: `NGO ${ngoName} has picked up your food and is on the way to deliver it.`,
        html: `<p><strong>${ngoName}</strong> has picked up your food and is on the way to deliver it.</p>`
      });

      await sendSMS({
        to: delivery.requester.phone,
        message: `Food pickup complete! ${ngoName} is on the way to deliver.`
      });
      break;

    case 'delivered':
      recipient = delivery.donor;
      subject = 'Your Donation Has Been Delivered Successfully!';
      text = `Your ${delivery.donation.foodType} donation has been successfully delivered to ${requesterName} by ${ngoName}.`;
      html = `<p>Your <strong>${delivery.donation.foodType}</strong> donation has been successfully delivered to <strong>${requesterName}</strong> by <strong>${ngoName}</strong>.</p>`;

      // Also notify requester
      await sendEmail({
        to: delivery.requester.email,
        subject: 'Your Food Has Been Delivered!',
        text: `Your food has been successfully delivered by ${ngoName}. Please rate your experience in the app.`,
        html: `<p>Your food has been successfully delivered by <strong>${ngoName}</strong>.</p><p>Please rate your experience in the app.</p>`
      });

      await sendSMS({
        to: delivery.requester.phone,
        message: `Food delivered! Please rate ${ngoName} and ${donorName} in the app.`
      });

      // Also send SMS to donor about successful delivery
      await sendSMS({
        to: delivery.donor.phone,
        message: `Your donation delivered successfully to ${requesterName} by ${ngoName}! Thank you for helping reduce food waste.`
      });
      break;

    default:
      return; // Don't send notification for other status changes
  }

  if (recipient) {
    try {
      await sendEmail({ to: recipient.email, subject, text, html });

      await sendSMS({
        to: recipient.phone,
        message: text
      });
    } catch (error) {
      console.error('Failed to send delivery status notification:', error.message);
    }
  }
}

// Send notification when rating is received
async function notifyRatingReceived(io, ratingData) {
  const { delivery, rating, type } = ratingData;

  try {
    let recipient, subject, text, html;

    if (type === 'donor') {
      recipient = delivery.donor;
      subject = `You Received a ${rating}★ Rating!`;
      text = `You received a ${rating} star rating for your donation. Thank you for helping fight food waste!`;
      html = `<p>You received a <strong>${rating}★</strong> rating for your donation.</p><p>Thank you for helping fight food waste!</p>`;
    } else if (type === 'ngo') {
      recipient = delivery.ngo;
      subject = `You Received a ${rating}★ Rating!`;
      text = `You received a ${rating} star rating for your delivery. Great work!`;
      html = `<p>You received a <strong>${rating}★</strong> rating for your delivery.</p><p>Great work!</p>`;
    }

    if (recipient) {
      await sendEmail({ to: recipient.email, subject, text, html });

      await sendSMS({
        to: recipient.phone,
        message: `You received ${rating}★ rating! ${text}`
      });
    }
  } catch (error) {
    console.error('Failed to send rating notification:', error.message);
  }
}

module.exports = {
  notifyNearbyUsers,
  notifyRequestAccepted,
  notifyDeliveryStatusChange,
  notifyRatingReceived
};
